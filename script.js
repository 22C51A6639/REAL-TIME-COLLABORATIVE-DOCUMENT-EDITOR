const socket = io();
const editor = document.getElementById("editor");
const saveBtn = document.getElementById("saveBtn");
const clearBtn = document.getElementById("clearBtn");
const userCount = document.getElementById("userCount");
const statusDot = document.querySelector(".status-dot");
const statusText = document.querySelector(".status-text");

// Enhanced debounce with immediate option
function debounce(func, wait, immediate = false) {
  let timeout;
  return function executedFunction(...args) {
    const callNow = immediate && !timeout;
    const later = () => {
      clearTimeout(timeout);
      if (!immediate) func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func(...args);
  };
}

// Auto-save functionality
const autoSave = debounce(() => {
  const text = editor.value;
  localStorage.setItem("savedText", text);
  socket.emit("save-text", text);
}, 1000);

// Enhanced change emission with cursor position tracking
const emitChange = debounce(() => {
  const cursorPosition = editor.selectionStart;
  socket.emit("text-change", {
    text: editor.value,
    cursorPosition: cursorPosition
  });
  autoSave();
}, 300);

editor.addEventListener("input", emitChange);

// Track cursor position
editor.addEventListener("click", () => {
  socket.emit("cursor-move", editor.selectionStart);
});

// Update textarea when receiving data with cursor preservation
socket.on("receive-text", (data) => {
  const cursorPosition = editor.selectionStart;
  if (data.text !== editor.value) {
    editor.value = data.text;
    editor.setSelectionRange(cursorPosition, cursorPosition);
  }
});

// Enhanced save functionality with timestamp
saveBtn.addEventListener("click", () => {
  const text = editor.value;
  const timestamp = new Date().toISOString();
  localStorage.setItem("savedText", text);
  localStorage.setItem("lastSaved", timestamp);
  socket.emit("save-text", { text, timestamp });
  
  // Visual feedback
  saveBtn.textContent = "✓ Saved";
  setTimeout(() => {
    saveBtn.textContent = "💾 Save";
  }, 2000);
});

// Enhanced clear functionality with undo
let lastContent = "";
clearBtn.addEventListener("click", () => {
  if (confirm("Are you sure you want to clear the editor?")) {
    lastContent = editor.value;
    editor.value = "";
    socket.emit("text-change", { text: "", cursorPosition: 0 });
    
    // Add undo button temporarily
    const undoBtn = document.createElement("button");
    undoBtn.textContent = "↩️ Undo Clear";
    undoBtn.className = "btn";
    undoBtn.onclick = () => {
      editor.value = lastContent;
      socket.emit("text-change", { text: lastContent, cursorPosition: 0 });
      undoBtn.remove();
    };
    clearBtn.parentNode.insertBefore(undoBtn, clearBtn.nextSibling);
    setTimeout(() => undoBtn.remove(), 5000);
  }
});

// Enhanced startup with version check
const savedText = localStorage.getItem("savedText");
const lastSaved = localStorage.getItem("lastSaved");
if (savedText) {
  editor.value = savedText;
  socket.emit("text-change", { text: savedText, cursorPosition: 0 });
  console.log(`Last saved: ${new Date(lastSaved).toLocaleString()}`);
}

// Enhanced connection status with reconnection attempts
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

socket.on("connect", () => {
  statusDot.style.backgroundColor = "#4CAF50";
  statusText.textContent = "Connected";
  reconnectAttempts = 0;
});

socket.on("disconnect", () => {
  statusDot.style.backgroundColor = "#f44336";
  statusText.textContent = "Disconnected";
  
  if (reconnectAttempts < maxReconnectAttempts) {
    reconnectAttempts++;
    setTimeout(() => {
      socket.connect();
    }, 1000 * reconnectAttempts);
  }
});

// Enhanced user count with typing indicators
socket.on("user-count", (data) => {
  userCount.textContent = data.count;
  if (data.typing) {
    statusText.textContent = "Someone is typing...";
    setTimeout(() => {
      statusText.textContent = "Connected";
    }, 1000);
  }
});

// Enhanced error handling with retry mechanism
socket.on("error", (error) => {
  console.error("Socket error:", error);
  const retry = confirm("Connection error occurred. Would you like to retry?");
  if (retry) {
    socket.connect();
  } else {
    alert("Please refresh the page to reconnect.");
  }
});

// Add keyboard shortcuts
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey) {
    switch(e.key) {
      case "s":
        e.preventDefault();
        saveBtn.click();
        break;
      case "k":
        e.preventDefault();
        clearBtn.click();
        break;
    }
  }
});
