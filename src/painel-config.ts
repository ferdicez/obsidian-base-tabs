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
			text: "As views das suas Bases aparecem como abas com ícones no lugar do menu suspenso. Clique com o botão direito numa aba para escolher o ícone — ou edite aqui os ícones já atribuídos.",
		});

		const entradas = Object.entries(this.plugin.dados.iconesPorView);
		if (entradas.length === 0) {
			containerEl.createEl("p", {
				cls: "setting-item-description",
				text: "Nenhum ícone personalizado ainda. Abra uma Base e clique com o botão direito numa aba.",
			});
			return;
		}

		containerEl.createEl("h3", { text: "Ícones por view" });

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
}
