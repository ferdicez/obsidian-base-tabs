import { Menu, setIcon } from "obsidian";
import { iconeDaView, modoDaView, type DadosBaseTabs, type ModoExibicao } from "./dados";
import { lerViewsDoArquivo, type ViewDoArquivo } from "./leitor-base";
import { adicionarView, encontrarToolbar, nomeViewAtiva, trocarPara } from "./seletor-nativo";
import type { App } from "obsidian";

/** Ícone Lucide padrão por tipo de view, quando a usuária não escolheu um. */
const ICONE_POR_TIPO: Record<string, string> = {
	table: "table",
	cards: "layout-grid",
	list: "list",
	map: "map",
	calendar: "calendar",
	gallery: "layout-grid",
};
const ICONE_FALLBACK = "layout-grid";

export interface CallbacksBarra {
	/** caminho do arquivo .base desta view (ou null se desconhecido). */
	caminhoBase: () => string | null;
	/** abre o fluxo de escolher ícone para (caminhoBase, nomeView). */
	escolherIcone: (caminhoBase: string | null, nomeView: string) => void;
	/** define o modo de exibição da aba (ícone+nome / só ícone / só nome) e persiste. */
	definirModo: (caminhoBase: string | null, nomeView: string, modo: ModoExibicao) => void;
	/**
	 * (Fase 2) Lista de nomes de views a mostrar, na ordem desejada. Se undefined/null, mostra todas
	 * as views do arquivo. Se definido, filtra e reordena por essa lista (nomes inexistentes são ignorados).
	 */
	filtrarViews?: () => string[] | null;
}

/**
 * Barra de abas de UMA Base. Lê as views do arquivo .base, injeta uma barra própria na toolbar nativa,
 * renderiza uma aba por view (ícone Lucide + nome), marca a ativa (via data-view-name) e liga o clique
 * à troca de view nativa. Idempotente: só re-renderiza quando o "hash" muda, evitando flicker.
 */
export class BarraDeAbas {
	private barraEl: HTMLElement | null = null;
	private hashAtual = "";

	// estado para reavaliar o overflow quando a largura muda.
	private trilhaEl: HTMLElement | null = null;
	private overflowEl: HTMLElement | null = null;
	private viewsRender: ViewDoArquivo[] = [];
	private nomeAtivaRender = "";
	private caminhoRender: string | null = null;
	private resizeObserver: ResizeObserver | null = null;
	private avaliandoOverflow = false;

	constructor(
		private app: App,
		private basesViewEl: HTMLElement,
		private dados: DadosBaseTabs,
		private callbacks: CallbacksBarra
	) {}

	atualizar(dados: DadosBaseTabs): void {
		this.dados = dados;
		try {
			const toolbar = encontrarToolbar(this.basesViewEl);
			if (!toolbar) return;

			const caminho = this.callbacks.caminhoBase();
			const todas = lerViewsDoArquivo(this.app, caminho);
			if (todas.length === 0) return; // cache do .base ainda não preenchido; próximo escaneamento resolve.

			const views = this.aplicarFiltro(todas);
			if (views.length === 0) return; // filtro não casou com nenhuma view; nada a mostrar.
			const curado = !!this.callbacks.filtrarViews?.();

			const ativa = nomeViewAtiva(this.basesViewEl) ?? "";
			const hash =
				views
					.map(
						(v) =>
							`${v.nome}:${iconeDaView(this.dados, caminho, v.nome) ?? ""}:${modoDaView(this.dados, caminho, v.nome)}`
					)
					.join("|") +
				"#" + ativa + (curado ? "@curado" : "");
			if (hash === this.hashAtual && this.barraEl?.isConnected) return;
			this.hashAtual = hash;

			toolbar.classList.add("base-tabs-ativo");
			this.render(toolbar, views, ativa, caminho, curado);
		} catch (e) {
			console.warn("[base-tabs] falha ao atualizar barra:", e);
		}
	}

	/**
	 * Aplica o filtro de views da Fase 2: se `filtrarViews()` devolver uma lista, mantém só as views
	 * cujos nomes estão nela, na ordem da lista. Se não houver filtro, devolve todas.
	 */
	private aplicarFiltro(todas: ViewDoArquivo[]): ViewDoArquivo[] {
		const filtro = this.callbacks.filtrarViews?.();
		if (!filtro || filtro.length === 0) return todas;
		const porNome = new Map(todas.map((v) => [v.nome, v]));
		return filtro.map((nome) => porNome.get(nome)).filter((v): v is ViewDoArquivo => !!v);
	}

	private render(
		toolbar: HTMLElement,
		views: ViewDoArquivo[],
		nomeAtiva: string,
		caminho: string | null,
		curado: boolean
	): void {
		if (this.barraEl) this.barraEl.remove();

		const barra = document.createElement("div");
		barra.className = "base-tabs-barra";

		// container das abas visíveis (o que sofre overflow).
		const trilha = barra.createDiv({ cls: "base-tabs-trilha" });
		views.forEach((view) => trilha.appendChild(this.criarAba(view, nomeAtiva, caminho)));

		// botão "..." (overflow) — preenchido depois de medir o que não coube.
		const overflowEl = barra.createEl("button", { cls: "base-tabs-aba base-tabs-overflow" });
		overflowEl.type = "button";
		overflowEl.setAttribute("aria-label", "Mais visualizações");
		overflowEl.style.display = "none";
		setIcon(overflowEl, "more-horizontal");

		// botão "+" só na base aberta como arquivo (não em embeds nativos nem curados).
		if (!curado && !this.ehEmbed()) {
			const addEl = barra.createEl("button", { cls: "base-tabs-aba base-tabs-add" });
			addEl.type = "button";
			addEl.setAttribute("aria-label", "Adicionar visualização");
			setIcon(addEl, "plus");
			addEl.addEventListener("click", () => void adicionarView(this.basesViewEl));
		}

		toolbar.prepend(barra);
		this.barraEl = barra;

		// mede o overflow agora e a cada mudança de largura da barra.
		this.trilhaEl = trilha;
		this.overflowEl = overflowEl;
		this.viewsRender = views;
		this.nomeAtivaRender = nomeAtiva;
		this.caminhoRender = caminho;
		this.reavaliarOverflow();
		this.observarLargura(barra);
	}

	/** Cria uma aba (ícone/nome conforme o modo + cliques + menu de contexto). */
	private criarAba(view: ViewDoArquivo, nomeAtiva: string, caminho: string | null): HTMLElement {
		const aba = document.createElement("button");
		aba.className = "base-tabs-aba";
		aba.type = "button";
		if (view.nome === nomeAtiva) aba.classList.add("is-active");

		const modo = modoDaView(this.dados, caminho, view.nome);

		if (modo !== "so-nome") {
			const iconeEl = aba.createSpan({ cls: "base-tabs-aba-icone" });
			const icone = iconeDaView(this.dados, caminho, view.nome) ?? ICONE_POR_TIPO[view.tipo] ?? ICONE_FALLBACK;
			setIcon(iconeEl, icone);
		}
		if (modo !== "so-icone") {
			aba.createSpan({ cls: "base-tabs-aba-nome", text: view.nome });
		}
		if (modo === "so-icone") aba.setAttribute("aria-label", view.nome);

		aba.addEventListener("click", () => {
			if (view.nome !== nomeAtiva) void trocarPara(this.basesViewEl, view.nome);
		});
		aba.addEventListener("contextmenu", (ev) => this.abrirMenuContexto(ev, view, caminho, modo));
		return aba;
	}

	private abrirMenuContexto(ev: MouseEvent, view: ViewDoArquivo, caminho: string | null, modo: ModoExibicao): void {
		ev.preventDefault();
		const menu = new Menu();
		menu.addItem((item) =>
			item
				.setTitle("Escolher ícone…")
				.setIcon("image")
				.onClick(() => this.callbacks.escolherIcone(caminho, view.nome))
		);
		menu.addSeparator();
		const opcoes: Array<{ modo: ModoExibicao; titulo: string; icone: string }> = [
			{ modo: "ambos", titulo: "Ícone e nome", icone: "layout-list" },
			{ modo: "so-icone", titulo: "Só ícone", icone: "image" },
			{ modo: "so-nome", titulo: "Só nome", icone: "type" },
		];
		for (const op of opcoes) {
			menu.addItem((item) =>
				item
					.setTitle(op.titulo)
					.setIcon(op.icone)
					.setChecked(modo === op.modo)
					.onClick(() => this.callbacks.definirModo(caminho, view.nome, op.modo))
			);
		}
		menu.showAtMouseEvent(ev);
	}

	/** True se a base está num embed (nativo `![[...]]` ou curado), não aberta como arquivo. */
	private ehEmbed(): boolean {
		return !!this.basesViewEl.closest(".internal-embed, .base-tabs-embed-curado, .markdown-preview-view, .markdown-rendered");
	}

	/** Reobserva a largura da barra para reavaliar o overflow quando o painel é redimensionado. */
	private observarLargura(barra: HTMLElement): void {
		this.resizeObserver?.disconnect();
		this.resizeObserver = new ResizeObserver(() => this.reavaliarOverflow());
		this.resizeObserver.observe(barra);
	}

	/**
	 * Mede quais abas cabem na largura disponível. As que não couberem são escondidas e vão para o
	 * menu "…" (que aparece antes do "+"). Se tudo couber, o "…" some.
	 */
	private reavaliarOverflow(): void {
		if (this.avaliandoOverflow) return; // evita loop com o ResizeObserver.
		const trilha = this.trilhaEl;
		const overflow = this.overflowEl;
		const barra = this.barraEl;
		if (!trilha || !overflow || !barra) return;

		const abas = Array.from(trilha.children) as HTMLElement[];
		if (abas.length === 0) return;

		this.avaliandoOverflow = true;
		try {
			this.medirEDistribuir(abas, trilha, overflow, barra);
		} finally {
			// solta o guard no próximo frame (depois que o layout assentou).
			requestAnimationFrame(() => (this.avaliandoOverflow = false));
		}
	}

	private medirEDistribuir(
		abas: HTMLElement[],
		_trilha: HTMLElement,
		overflow: HTMLElement,
		barra: HTMLElement
	): void {
		// mostra todas para medir do zero.
		abas.forEach((a) => (a.style.display = ""));
		overflow.style.display = "none";

		// largura que a trilha pode ocupar = largura da barra menos o "…" e o "+" (se houver).
		const larguraBarra = barra.clientWidth;
		const larguraExtras = this.larguraDe(overflow) + this.larguraDosBotoesFixos();
		const disponivel = larguraBarra - larguraExtras;

		// soma as larguras das abas até estourar; as seguintes vão pro overflow.
		let usado = 0;
		const escondidas: number[] = [];
		abas.forEach((aba, i) => {
			const w = this.larguraDe(aba);
			if (usado + w <= disponivel || i === 0) {
				usado += w; // a primeira aba sempre aparece, mesmo apertada.
			} else {
				escondidas.push(i);
				aba.style.display = "none";
			}
		});

		if (escondidas.length === 0) {
			overflow.style.display = "none";
			return;
		}

		// configura o "…" para abrir um menu com as views escondidas.
		overflow.style.display = "";
		overflow.onclick = (ev) => {
			const menu = new Menu();
			for (const i of escondidas) {
				const view = this.viewsRender[i];
				if (!view) continue;
				const icone =
					iconeDaView(this.dados, this.caminhoRender, view.nome) ?? ICONE_POR_TIPO[view.tipo] ?? ICONE_FALLBACK;
				menu.addItem((item) =>
					item
						.setTitle(view.nome)
						.setIcon(icone)
						.setChecked(view.nome === this.nomeAtivaRender)
						.onClick(() => {
							if (view.nome !== this.nomeAtivaRender) void trocarPara(this.basesViewEl, view.nome);
						})
				);
			}
			menu.showAtMouseEvent(ev);
		};
	}

	/** Largura de um elemento + o gap aproximado (--size-4-1 = 4px). Mede mesmo se estiver oculto. */
	private larguraDe(el: HTMLElement): number {
		const estavaOculto = el.style.display === "none";
		if (estavaOculto) el.style.display = "";
		const w = el.getBoundingClientRect().width + 4;
		if (estavaOculto) el.style.display = "none";
		return w;
	}

	/** Largura somada dos botões fixos após a trilha (o "+"), se presentes. */
	private larguraDosBotoesFixos(): number {
		const add = this.barraEl?.querySelector<HTMLElement>(".base-tabs-add");
		return add ? this.larguraDe(add) : 0;
	}

	destruir(): void {
		try {
			this.resizeObserver?.disconnect();
			this.resizeObserver = null;
			this.barraEl?.remove();
			const toolbar = encontrarToolbar(this.basesViewEl);
			toolbar?.classList.remove("base-tabs-ativo");
		} catch {
			/* nada a fazer */
		}
		this.barraEl = null;
		this.trilhaEl = null;
		this.overflowEl = null;
		this.hashAtual = "";
	}
}
