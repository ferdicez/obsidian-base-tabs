import type { Plugin } from "obsidian";

/**
 * Dados persistidos do plugin (data.json). Guarda apenas o ícone escolhido por view.
 * Nunca escrevemos nos arquivos .base — a chave é derivada do caminho do .base + nome da view.
 */
export interface DadosBaseTabs {
	/** chave: "<caminho-do-.base>::<nome-da-view>"  →  id de ícone Lucide (ex.: "table") */
	iconesPorView: Record<string, string>;
}

export const DADOS_PADRAO: DadosBaseTabs = {
	iconesPorView: {},
};

export async function carregarDados(plugin: Plugin): Promise<DadosBaseTabs> {
	const data = await plugin.loadData();
	return Object.assign({}, DADOS_PADRAO, data);
}

export async function salvarDados(plugin: Plugin, dados: DadosBaseTabs): Promise<void> {
	await plugin.saveData(dados);
}

/**
 * Chave estável de uma view. Como o Obsidian não dá id às views (só `name`+`type`),
 * a identidade é (caminho do .base, nome da view). Renomear a view/o arquivo desvincula o ícone.
 */
export function chaveDaView(caminhoBase: string | null, nomeView: string): string {
	return `${caminhoBase ?? "?"}::${nomeView}`;
}

/** Ícone salvo para uma view, ou undefined se a usuária ainda não escolheu nenhum. */
export function iconeDaView(dados: DadosBaseTabs, caminhoBase: string | null, nomeView: string): string | undefined {
	return dados.iconesPorView[chaveDaView(caminhoBase, nomeView)];
}
