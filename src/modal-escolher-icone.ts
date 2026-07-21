import { App, Modal, getIconIds, setIcon } from "obsidian";

let idsCache: string[] | null = null;

/** Todos os ícones que o Obsidian suporta (Lucide), sem o prefixo "lucide-". */
function todosOsIcones(): string[] {
	if (!idsCache) {
		idsCache = getIconIds().map((id) => (id.startsWith("lucide-") ? id.slice("lucide-".length) : id));
	}
	return idsCache;
}

const MAX_RESULTADOS = 60;

/**
 * Modal com busca + grid de ícones Lucide. Digitar filtra por substring; clicar seleciona e fecha.
 * `onEscolher(undefined)` limpa o ícone.
 */
export class ModalEscolherIcone extends Modal {
	private inputEl!: HTMLInputElement;
	private resultadosEl!: HTMLElement;
	private previewEl!: HTMLElement;
	private valor: string | undefined;

	constructor(
		app: App,
		private nomeView: string,
		valorInicial: string | undefined,
		private onEscolher: (icone: string | undefined) => void
	) {
		super(app);
		this.valor = valorInicial;
	}

	onOpen(): void {
		this.titleEl.setText(`Ícone da view "${this.nomeView}"`);
		const wrap = this.contentEl.createDiv({ cls: "base-tabs-icon-picker" });

		const linha = wrap.createDiv({ cls: "base-tabs-icon-picker-preview" });
		this.previewEl = linha.createSpan({ cls: "base-tabs-icon-picker-preview-icon" });
		this.renderPreview();

		this.inputEl = linha.createEl("input", {
			type: "text",
			placeholder: "Buscar ícone (ex.: user, calendar, table)...",
			cls: "base-tabs-icon-picker-search",
		});

		const limpar = linha.createEl("button", { text: "Sem ícone", cls: "base-tabs-icon-picker-clear" });
		limpar.addEventListener("click", () => {
			this.valor = undefined;
			this.onEscolher(undefined);
			this.close();
		});

		this.resultadosEl = wrap.createDiv({ cls: "base-tabs-icon-picker-results" });

		this.inputEl.addEventListener("input", () => this.renderResultados(this.inputEl.value.trim().toLowerCase()));
		window.setTimeout(() => this.inputEl.focus(), 0);
	}

	private renderPreview(): void {
		this.previewEl.empty();
		if (this.valor) setIcon(this.previewEl, this.valor);
	}

	private renderResultados(query: string): void {
		this.resultadosEl.empty();
		if (!query) return;

		const matches = todosOsIcones()
			.filter((id) => id.includes(query))
			.slice(0, MAX_RESULTADOS);

		if (matches.length === 0) {
			this.resultadosEl.createEl("p", { cls: "base-tabs-empty", text: "Nenhum ícone encontrado." });
			return;
		}

		matches.forEach((id) => {
			const cell = this.resultadosEl.createDiv({ cls: "base-tabs-icon-picker-cell", attr: { title: id } });
			setIcon(cell, id);
			cell.addEventListener("click", () => {
				this.valor = id;
				this.onEscolher(id);
				this.close();
			});
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
