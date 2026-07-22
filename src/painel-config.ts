import { App, PluginSettingTab, Setting, setIcon } from "obsidian";
import type BaseTabsPlugin from "./main";
import { ModalEscolherIcone } from "./modal-escolher-icone";

export class PainelConfigBaseTabs extends PluginSettingTab {
	constructor(app: App, private plugin: BaseTabsPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Base Tabs" });
		containerEl.createEl("p", {
			cls: "setting-item-description",
			text: "As views das suas Bases aparecem como abas com ícones no lugar do menu suspenso. Clique com o botão direito numa aba para escolher o ícone e o modo de exibição (ícone e nome / só ícone / só nome).",
		});

		this.renderTutorialEmbed(containerEl);

		containerEl.createEl("h3", { text: "Ícones por view" });

		const entradas = Object.entries(this.plugin.dados.iconesPorView);
		if (entradas.length === 0) {
			containerEl.createEl("p", {
				cls: "setting-item-description",
				text: "Nenhum ícone personalizado ainda. Abra uma Base e clique com o botão direito numa aba.",
			});
			return;
		}

		entradas
			.sort((a, b) => a[0].localeCompare(b[0]))
			.forEach(([chave, icone]) => {
				const [caminhoBase, nomeView] = chave.split("::");
				const setting = new Setting(containerEl).setName(nomeView).setDesc(caminhoBase);

				setting.settingEl.createDiv({ cls: "base-tabs-config-preview" }, (el) => setIcon(el, icone));

				setting.addButton((btn) =>
					btn.setButtonText("Trocar ícone").onClick(() => {
						new ModalEscolherIcone(this.app, nomeView, icone, async (novo) => {
							if (novo) this.plugin.dados.iconesPorView[chave] = novo;
							else delete this.plugin.dados.iconesPorView[chave];
							await this.plugin.salvar();
							this.plugin.gerenciador?.reescanear();
							this.display();
						}).open();
					})
				);

				setting.addExtraButton((btn) =>
					btn
						.setIcon("trash")
						.setTooltip("Remover ícone")
						.onClick(async () => {
							delete this.plugin.dados.iconesPorView[chave];
							await this.plugin.salvar();
							this.plugin.gerenciador?.reescanear();
							this.display();
						})
				);
			});
	}

	/** Tutorial de como embedar uma base mostrando só algumas views (bloco base-tabs). */
	private renderTutorialEmbed(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "Embed com views escolhidas" });
		containerEl.createEl("p", {
			cls: "setting-item-description",
			text: "Para embedar uma base numa nota mostrando só algumas views (em vez de todas), use um bloco de código base-tabs. Escreva o nome da base e as views que quer, separadas por vírgula:",
		});

		// exemplo copiável.
		const exemplo = ["```base-tabs", "base: Nome Da Base", "views: Tabela, Kanban", "```"].join("\n");
		const bloco = containerEl.createEl("pre", { cls: "base-tabs-tutorial-code" });
		bloco.createEl("code", { text: exemplo });

		const btnCopiar = containerEl.createEl("button", { text: "Copiar exemplo", cls: "base-tabs-tutorial-copy" });
		btnCopiar.addEventListener("click", async () => {
			await navigator.clipboard.writeText(exemplo);
			btnCopiar.setText("Copiado!");
			window.setTimeout(() => btnCopiar.setText("Copiar exemplo"), 1500);
		});

		const dicas = containerEl.createEl("ul", { cls: "setting-item-description base-tabs-tutorial-dicas" });
		dicas.createEl("li", {
			text: 'O nome da base é o do arquivo .base, sem a extensão (ex.: "Clientes" para Clientes.base). Pode incluir a pasta: "Projetos/Clientes".',
		});
		dicas.createEl("li", {
			text: "Os nomes das views precisam ser exatamente iguais aos da base (maiúsculas e acentos contam). Se um nome não bater, aquela aba simplesmente não aparece.",
		});
		dicas.createEl("li", {
			text: "A ordem das views no bloco é a ordem em que as abas aparecem.",
		});
		dicas.createEl("li", {
			text: "Dica: para embedar mostrando TODAS as views, basta usar o embed normal do Obsidian: ![[Nome Da Base.base]].",
		});
	}
}
