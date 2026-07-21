import { parseYaml, type App, type TFile } from "obsidian";

/** Uma view declarada no arquivo .base. */
export interface ViewDoArquivo {
	nome: string;
	tipo: string;
}

/**
 * Lê a lista de views de um arquivo .base (YAML). Estrutura:
 *   views:
 *     - type: table
 *       name: Tabela
 *     - type: cards
 *       name: teste 3
 *
 * Retorna [] se não conseguir ler/parsear. Usa o cache do Obsidian (leitura síncrona) quando possível.
 */
export function lerViewsDoArquivo(app: App, caminhoBase: string | null): ViewDoArquivo[] {
	if (!caminhoBase) return [];
	const file = app.vault.getAbstractFileByPath(caminhoBase) as TFile | null;
	if (!file) return [];

	const conteudo = obterConteudoCache(app, file);
	if (!conteudo) return [];

	try {
		const dados = parseYaml(conteudo) as { views?: Array<{ name?: string; type?: string }> } | null;
		const views = dados?.views;
		if (!Array.isArray(views)) return [];
		return views
			.filter((v) => typeof v?.name === "string" && v.name.length > 0)
			.map((v) => ({ nome: v.name as string, tipo: v.type ?? "" }));
	} catch {
		return [];
	}
}

/**
 * Conteúdo do arquivo via cache do Obsidian (síncrono). `cachedRead` é assíncrono; para manter o
 * fluxo síncrono do render, usamos o texto que o Obsidian já tem em memória quando disponível.
 * Fallback: null (quem chama lida com lista vazia e re-tenta no próximo escaneamento).
 */
function obterConteudoCache(app: App, file: TFile): string | null {
	// A API pública não expõe leitura síncrona garantida; usamos um cache próprio preenchido
	// de forma assíncrona por lerViewsDoArquivoAsync. Aqui devolvemos o que estiver em cache.
	return cacheConteudo.get(file.path) ?? null;
}

const cacheConteudo = new Map<string, string>();

/**
 * Versão assíncrona: lê o arquivo de fato e popula o cache, para as próximas leituras síncronas.
 * Chamar isto quando o caminho é conhecido; o render usa o cache já preenchido.
 */
export async function preencherCacheBase(app: App, caminhoBase: string | null): Promise<void> {
	if (!caminhoBase) return;
	const file = app.vault.getAbstractFileByPath(caminhoBase) as TFile | null;
	if (!file) return;
	try {
		const texto = await app.vault.cachedRead(file);
		cacheConteudo.set(file.path, texto);
	} catch {
		/* ignora */
	}
}

/** Invalida o cache de um .base (ex.: ao editar as views). */
export function invalidarCacheBase(caminhoBase: string): void {
	cacheConteudo.delete(caminhoBase);
}
