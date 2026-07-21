import type { Plugin } from "obsidian";

/** Como uma aba é exibida: ícone + nome (padrão), só o ícone, ou só o nome. */
export type ModoExibicao = "ambos" | "so-icone" | "so-nome";
export const MODO_PADRAO: ModoExibicao = "ambos";

/**
 * Dados persistidos do plugin (data.json). Guarda o ícone e o modo de exibição escolhidos por view.
 * Nunca escrevemos nos arquivos .base — a chave é derivada do caminho do .base + nome da view.
 */
export interface DadosBaseTabs {
	/** chave: "<caminho-do-.base>::<nome-da-view>"  →  id de ícone Lucide (ex.: "table") */
	iconesPorView: Record<string, string>;
	/** chave: "<caminho-do-.base>::<nome-da-view>"  →  modo de exibição da aba */
	exibicaoPorView: Record<string, ModoExibicao>;
}

export const DADOS_PADRAO: DadosBaseTabs = {
	iconesPorView: {},
	exibicaoPorView: {},
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

/** Modo de exibição salvo para uma view (ou o padrão "ambos"). */
export function modoDaView(dados: DadosBaseTabs, caminhoBase: string | null, nomeView: string): ModoExibicao {
	return dados.exibicaoPorView?.[chaveDaView(caminhoBase, nomeView)] ?? MODO_PADRAO;
}
