import type { App, TFile } from "obsidian";
import { BarraDeAbas } from "./barra-de-abas";
import type { DadosBaseTabs } from "./dados";
import { preencherCacheBase } from "./leitor-base";

/**
 * Cérebro do plugin. Observa o workspace, encontra cada Base renderizada (.bases-view) e mantém
 * uma BarraDeAbas por Base (via WeakMap, para não duplicar). Antes de renderizar, garante que o
 * conteúdo do arquivo .base está em cache (leitura assíncrona) — as views vêm do arquivo, não do DOM.
 */
export class GerenciadorDeAbas {
	private observer: MutationObserver | null = null;
	private barras = new WeakMap<HTMLElement, BarraDeAbas>();
	private agendado = false;
	private cacheEmAndamento = new Set<string>();

	constructor(
		private app: App,
		private getDados: () => DadosBaseTabs,
		private escolherIcone: (caminhoBase: string | null, nomeView: string) => void
	) {}

	iniciar(): void {
		const raiz = this.app.workspace.containerEl;
		this.observer = new MutationObserver(() => this.agendarEscaneamento());
		this.observer.observe(raiz, { childList: true, subtree: true });
		this.agendarEscaneamento();
	}

	agendarEscaneamento(): void {
		if (this.agendado) return;
		this.agendado = true;
		requestAnimationFrame(() => {
			this.agendado = false;
			this.escanear();
		});
	}

	private escanear(): void {
		const dados = this.getDados();
		const bases = document.querySelectorAll<HTMLElement>(".bases-view");
		bases.forEach((baseEl) => {
			// Ignora bases dentro de um embed curado (Fase 2): essas são geridas pelo processador do
			// bloco, que já aplica a barra com o filtro de views. Sem isto, a base receberia 2 barras.
			if (baseEl.closest(".base-tabs-embed-curado")) return;

			const caminho = this.caminhoDaBase(baseEl);

			// Garante o conteúdo do .base em cache. Se ainda não temos, dispara a leitura e reescaneia
			// quando terminar (o render seguinte já encontra as views).
			if (caminho) this.garantirCache(caminho);

			let barra = this.barras.get(baseEl);
			if (!barra) {
				barra = new BarraDeAbas(this.app, baseEl, dados, {
					caminhoBase: () => this.caminhoDaBase(baseEl),
					escolherIcone: this.escolherIcone,
				});
				this.barras.set(baseEl, barra);
			}
			barra.atualizar(dados);
		});
	}

	/** Lê o .base em background (uma vez por caminho) e reescaneia ao concluir. */
	private garantirCache(caminho: string): void {
		if (this.cacheEmAndamento.has(caminho)) return;
		this.cacheEmAndamento.add(caminho);
		preencherCacheBase(this.app, caminho).finally(() => {
			this.cacheEmAndamento.delete(caminho);
			this.agendarEscaneamento();
		});
	}

	/**
	 * Descobre o caminho do arquivo .base a partir do elemento .bases-view.
	 * 1) leaf do tipo "bases" cujo container contém este elemento → file.path.
	 * 2) embed: atributo src/data-path do container do embed.
	 */
	private caminhoDaBase(baseEl: HTMLElement): string | null {
		const leaves = this.app.workspace.getLeavesOfType("bases");
		for (const leaf of leaves) {
			const containerEl = (leaf.view as { containerEl?: HTMLElement }).containerEl;
			if (containerEl && containerEl.contains(baseEl)) {
				const file = (leaf.view as { file?: TFile }).file;
				if (file?.path) return file.path;
			}
		}
		const embed = baseEl.closest<HTMLElement>(".bases-embed, .internal-embed[src], [data-path]");
		const src = embed?.getAttribute("src") ?? embed?.getAttribute("data-path");
		if (src) {
			// embeds podem ter forma "Arquivo.base" ou "Arquivo" — normaliza para .base.
			return src.endsWith(".base") ? src : `${src}.base`;
		}
		return null;
	}

	reescanear(): void {
		this.agendarEscaneamento();
	}

	destruir(): void {
		this.observer?.disconnect();
		this.observer = null;
		document.querySelectorAll<HTMLElement>(".bases-view").forEach((baseEl) => {
			this.barras.get(baseEl)?.destruir();
		});
		this.barras = new WeakMap();
	}
}
