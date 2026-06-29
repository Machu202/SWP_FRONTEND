document.addEventListener("DOMContentLoaded", () => {
  const loginButton = document.getElementById("btn-login");

  if (!loginButton) return;

  loginButton.addEventListener("click", async (event) => {
    event.preventDefault();

    const usernameInput = document.querySelector("input[name='username']");
    const passwordInput = document.querySelector("input[name='password']");
    const roleSelect = document.getElementById("login-role-select");

    const username = usernameInput?.value.trim();
    const password = passwordInput?.value.trim();
    const selectedRole = roleSelect?.value;

    if (!username || !password) {
      alert("Please enter username and password.");
      return;
    }

    try {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username,
          password,
        }),
      });

      localStorage.setItem("accessToken", data.token);
      localStorage.setItem("userRole", data.role || selectedRole);
      localStorage.setItem("username", username);

      const roleRoutes = {
        MANGAKA: "mangaka-dashboard.html",
        ASSISTANT: "assistant-dashboard.html",
        TANTOU_EDITOR: "tantou-dashboard.html",
        EDITORIAL_BOARD: "board-dashboard.html",
        ADMIN: "admin-dashboard.html",

        mangaka: "mangaka-dashboard.html",
        assistant: "assistant-dashboard.html",
        tantou: "tantou-dashboard.html",
        editorial: "board-dashboard.html",
        admin: "admin-dashboard.html",
      };

      const finalRole = data.role || selectedRole;
      window.location.href = roleRoutes[finalRole] || "mangaka-dashboard.html";
    } catch (error) {
      console.error(error);
      alert("Login failed. Please check username/password or backend server.");
    }
  });
});
