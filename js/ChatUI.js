class ChatUI {
  #box;

  constructor(containerId) {
    this.#box = document.getElementById(containerId);
  }

  addMsg(text, isCoach) {
    const el = document.createElement('div');
    el.className = 'msg ' + (isCoach ? 'coach' : 'user');
    el.innerHTML = `
      <div class="msg-avatar ${isCoach ? 'avatar-coach' : 'avatar-user'}">${isCoach ? 'C' : 'B'}</div>
      <div class="msg-bubble">${text.replace(/\n/g, '<br>')}</div>`;
    this.#box.appendChild(el);
    this.#scrollToBottom();
  }

  addTyping() {
    const el = document.createElement('div');
    el.className = 'msg coach';
    el.id = 'typingMsg';
    el.innerHTML = `
      <div class="msg-avatar avatar-coach">C</div>
      <div class="msg-bubble"><div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div></div>`;
    this.#box.appendChild(el);
    this.#scrollToBottom();
  }

  removeTyping() {
    document.getElementById('typingMsg')?.remove();
  }

  #scrollToBottom() { this.#box.scrollTop = this.#box.scrollHeight; }
}
