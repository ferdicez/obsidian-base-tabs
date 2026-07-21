import {
	MarkdownRenderChild,
	MarkdownRenderer,
	type App,
	type MarkdownPostProcessorContext,
} from "obsidian";
import { BarraDeAbas } from "../barra-de-abas";
import type { DadosBaseTabs, ModoExibicao } from "../dados";
import { preencherCacheBase } from "../leitor-base";

/** Config parseada de um bloco ```base-tabs. */
interface ConfigBloco {
	base: string | null;
	views: string[];
}

/**
 * Processa o bloco de código ```base-tabs. Sintaxe:
 *   base: Caminho/Da/Base            (ou "Base.base"; sem extensão o plugin adiciona)
 *   views: view A, view B, view C    (lista separada por vírgula, na ordem desejada)
 *
 * Renderiza o embed NATIVO da base (![[...]]) e aplica as abas curadas por cima, mostrando só as
 * views listadas. A base é a nativa do Obsidian — o plugin só cura as abas.
 */
export class ProcessadorBaseTabs {
	constructor(
		private app: App,
		private getDados: () => DadosBaseTabs,
		private escolherIcone: (caminhoBase: string | null, nomeView: string) => void,
		private definirModo: (caminhoBase: string | null, nomeView: string, modo: ModoExibicao) => void,
		/** registra um ouvinte de re-render (ex.: troca de ícone) e devolve a função para removê-lo. */
		private registrarOuvinteReescan: (ouvinte: () => void) => () => void
	) {}

	async processar(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): Promise<void> {
		const cfg = parseConfig(source);
		if (!cfg.base) {
			el.createEl("div", { cls: "base-tabs-erro", text: "base-tabs: informe `base:` no bloco." });
			return;
		}
		const caminhoBase = cfg.base.endsWith(".base") ? cfg.base : `${cfg.base}.base`;

		const child = new EmbedCurado(
			this.app,
			el,
			caminhoBase,
			cfg.views,
			this.getDados,
			this.escolherIcone,
			this.definirModo,
			ctx.sourcePath,
			this.registrarOuvinteReescan
		);
		ctx.addChild(child); // o Obsidian gerencia load/unload (limpeza automática ao sair da tela).
	}
}

/**
 * MarkdownRenderChild que renderiza o embed nativo da base e liga a barra de abas curada.
 * Ao ser descarregado (bloco sai da tela), o Obsidian chama onunload → desconecta o observer.
 */
class EmbedCurado extends MarkdownRenderChild {
	private observer: MutationObserver | null = null;
	private barra: BarraDeAbas | null = null;
	private removerOuvinte: (() => void) | null = null;
	private containerInterno: HTMLElement | null = null;

	constructor(
		private appRef: App,
		containerEl: HTMLElement,
		private caminhoBase: string,
		private views: string[],
		private getDados: () => DadosBaseTabs,
		private escolherIcone: (caminhoBase: string | null, nomeView: string) => void,
		private definirModo: (caminhoBase: string | null, nomeView: string, modo: ModoExibicao) => void,
		private sourcePath: string,
		private registrarOuvinteReescan: (ouvinte: () => void) => () => void
	) {
		super(containerEl);
	}

	async onload(): Promise<void> {
		const container = this.containerEl.createDiv({ cls: "base-tabs-embed-curado" });
		this.containerInterno = container;

		// pré-carrega as views do .base para a barra ter a lista assim que a .bases-view aparecer.
		await preencherCacheBase(this.appRef, this.caminhoBase);

		// renderiza o embed nativo da base dentro do nosso container (this = Component owner).
		await MarkdownRenderer.render(this.appRef, `![[${this.caminhoBase}]]`, container, this.sourcePath, this);

		// observa a .bases-view surgir e (re)aplica a barra curada a cada mudança do DOM.
		this.observer = new MutationObserver(() => this.aplicar(container));
		this.observer.observe(container, { childList: true, subtree: true });
		this.aplicar(container);

		// re-render externo (ex.: troca de ícone pelo modal).
		this.removerOuvinte = this.registrarOuvinteReescan(() => {
			if (this.containerInterno) this.aplicar(this.containerInterno);
		});
	}

	private aplicar(container: HTMLElement): void {
		const baseEl = container.querySelector<HTMLElement>(".bases-view");
		if (!baseEl) return;
		if (!this.barra) {
			this.barra = new BarraDeAbas(this.appRef, baseEl, this.getDados(), {
				caminhoBase: () => this.caminhoBase,
				escolherIcone: this.escolherIcone,
				definirModo: this.definirModo,
				filtrarViews: () => this.views,
			});
		}
		this.barra.atualizar(this.getDados());
	}

	onunload(): void {
		this.observer?.disconnect();
		this.observer = null;
		this.barra?.destruir();
		this.barra = null;
		this.removerOuvinte?.();
		this.removerOuvinte = null;
		this.containerInterno = null;
	}
}

/** Parse simples de `chave: valor` por linha. `views` é uma lista separada por vírgula. */
function parseConfig(source: string): ConfigBloco {
	const cfg: ConfigBloco = { base: null, views: [] };
	for (const linhaBruta of source.split("\n")) {
		const linha = linhaBruta.trim();
		if (!linha || linha.startsWith("#")) continue;
		const sep = linha.indexOf(":");
		if (sep === -1) continue;
		const chave = linha.slice(0, sep).trim().toLowerCase();
		const valor = linha.slice(sep + 1).trim();
		if (chave === "base") cfg.base = valor.replace(/^\[\[|\]\]$/g, "").trim() || null;
		else if (chave === "views" || chave === "visualizações" || chave === "visualizacoes") {
			cfg.views = valor
				.split(",")
				.map((v) => v.trim())
				.filter((v) => v.length > 0);
		}
	}
	return cfg;
}
