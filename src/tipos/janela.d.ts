// Declara o que o preload.ts coloca em "window.api" (só existe no renderer).
interface Window {
  api: {
    chamar<T = any>(canal: string, dados?: unknown): Promise<RespostaIpc<T>>;
  };
}
