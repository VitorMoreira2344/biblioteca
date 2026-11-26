// avisa pro typescript que a janela tem o window api que o preload criou
interface Window {
  api: {
    chamar<T = any>(canal: string, dados?: unknown): Promise<RespostaIpc<T>>;
  };
}
