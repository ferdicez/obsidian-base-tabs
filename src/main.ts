import { Plugin } from "obsidian";
import { carregarDados, chaveDaView, iconeDaView, salvarDados, type DadosBaseTabs } from "./dados";
import { ProcessadorBaseTabs } from "./codeblock/processador";
import { GerenciadorDeAbas } from "./gerenciador-de-abas";
import { ModalEscolherIcone } from "./modal-escolher-icone";
import { PainelConfigBaseTabs } from "./painel-config";

/** Linguagem do bloco de código da Fase 2 (embed curado). */
export const LINGUAGEM_BLOCO = "base-tabs";

export default class BaseTabsPlugin extends Plugin {
	dados!: DadosBaseTabs;
	gerenciador: GerenciadorDeAbas | null = null;
	/** ouvintes para forçar re-render (ex.: após trocar um ícone) — inclui embeds curados. */
	private ouvintesReescan = new Set<() => void>();

	async onload() {
		this.dados = await carregarDados(this);

		this.addSettingTab(new PainelConfigBaseTabs(this.app, this));

		this.gerenciador = new GerenciadorDeAbas(
			this.app,
			() => this.dados,
			(caminhoBase, nomeView) => this.abrirEscolhaDeIcone(caminhoBase, nomeView)
		);

		// Fase 2: bloco ```base-tabs (embed curado por página).
		const processador = new ProcessadorBaseTabs(
			this.app,
			() => this.dados,
			(caminhoBase, nomeView) => this.abrirEscolhaDeIcone(caminhoBase, nomeView),
			(ouvinte) => this.registrarOuvinteReescan(ouvinte)
		);
		this.registerMarkdownCodeBlockProcessor(LINGUAGEM_BLOCO, (src, el, ctx) =>
			processador.processar(src, el, ctx)
		);

		// Espera o layout estar pronto para não brigar com o boot do Obsidian.
		this.app.workspace.onLayoutReady(() => this.gerenciador?.iniciar());

		// Reescaneia em mudanças de layout/aba ativa (bases que abrem depois, splits, etc.).
		this.registerEvent(this.app.workspace.on("layout-change", () => this.gerenciador?.reescanear()));
		this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.gerenciador?.reescanear()));
	}

	onunload() {
		this.gerenciador?.destruir();
		this.gerenciador = null;
		this.ouvintesReescan.clear();
	}

	async salvar(): Promise<void> {
		await salvarDados(this, this.dados);
	}

	/** Registra um ouvinte de re-render e devolve a função para removê-lo. */
	registrarOuvinteReescan(ouvinte: () => void): () => void {
		this.ouvintesReescan.add(ouvinte);
		return () => this.ouvintesReescan.delete(ouvinte);
	}

	/** Força re-render de tudo: base aberta como arquivo + embeds curados. */
	reescanearTudo(): void {
		this.gerenciador?.reescanear();
		this.ouvintesReescan.forEach((f) => f());
	}

	/** Abre o modal de ícone e persiste a escolha para (caminhoBase, nomeView). */
	private abrirEscolhaDeIcone(caminhoBase: string | null, nomeView: string): void {
		const chave = chaveDaView(caminhoBase, nomeView);
		const atual = iconeDaView(this.dados, caminhoBase, nomeView);
		new ModalEscolherIcone(this.app, nomeView, atual, async (novo) => {
			if (novo) this.dados.iconesPorView[chave] = novo;
			else delete this.dados.iconesPorView[chave];
			await this.salvar();
			this.reescanearTudo();
		}).open();
	}
}
