/**
 * Correção do "espaço em branco" no celular após fechar o teclado.
 *
 * No iOS (e alguns Androids), quando o teclado abre com um campo dentro de um
 * drawer/dialog fixo, o navegador desloca a viewport visual; ao fechar o
 * teclado, a página às vezes FICA presa nesse deslocamento — aparece uma faixa
 * branca e os campos "sobem" da tela, obrigando o cliente a mexer no zoom.
 *
 * Este fix escuta o fim da digitação (focusout) e, se havia um overlay aberto
 * (checkout, dialogs), reancora o scroll da página em 0 — o overlay é fixo,
 * então o cliente não percebe nada além da tela voltar ao lugar.
 */
export function installMobileKeyboardFix() {
  if (typeof window === "undefined") return;
  // Só em telas de toque (não interfere no desktop).
  const isTouch = window.matchMedia?.("(pointer: coarse)")?.matches;
  if (!isTouch) return;

  const isTypingTarget = (el: Element | null): boolean =>
    !!el &&
    (el.tagName === "INPUT" ||
      el.tagName === "TEXTAREA" ||
      el.tagName === "SELECT" ||
      (el as HTMLElement).isContentEditable);

  document.addEventListener("focusout", () => {
    // Pequena espera: se o foco pulou para OUTRO campo, o teclado segue aberto.
    setTimeout(() => {
      if (isTypingTarget(document.activeElement)) return;

      // Só reancora quando há um overlay fixo aberto (drawer/dialog) — é o
      // cenário do bug; fora dele, preserva a rolagem normal do cardápio.
      const hasOverlay = document.querySelector(
        '[role="dialog"], [vaul-drawer], [data-state="open"][data-vaul-drawer]'
      );
      if (!hasOverlay) return;

      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }, 80);
  });

  // Ao fechar o teclado, o iOS às vezes mantém a viewport visual deslocada
  // mesmo sem blur (ex.: botão "OK"/"Concluído"). O visualViewport avisa.
  const vv = window.visualViewport;
  if (vv) {
    let lastHeight = vv.height;
    vv.addEventListener("resize", () => {
      const grew = vv.height > lastHeight + 80; // teclado fechou
      lastHeight = vv.height;
      if (!grew) return;
      if (isTypingTarget(document.activeElement)) return;
      const hasOverlay = document.querySelector('[role="dialog"], [vaul-drawer]');
      if (hasOverlay) {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }
    });
  }
}
