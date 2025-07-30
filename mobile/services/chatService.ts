const API_BASE_URL = "https://emotica.onrender.com";

const getAuthHeader = (token: string) => {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
};

export const chatService = {
  getChatHistory: async (userId: string, token: string) => {
    try {
      const headers = getAuthHeader(token);
      const response = await fetch(
        `${API_BASE_URL}/chat/history?userId=${userId}`,
        {
          method: "GET",
          headers,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch chat history");
      }

      return response.json();
    } catch (error) {
      console.error("getChatHistory error:", error);
      throw error;
    }
  },

  sendMessage: async (message: string, token: string) => {
    try {
      const headers = getAuthHeader(token);
      const response = await fetch(`${API_BASE_URL}/chat/`, {
        method: "POST",
        headers,
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to send message");
      }

      return response.json();
    } catch (error) {
      console.error("sendMessage error:", error);
      throw error;
    }
  },

  endSession: async (token: string) => {
    try {
      const headers = getAuthHeader(token);
      await fetch(`${API_BASE_URL}/end-session`, {
        method: "POST",
        headers,
      });
      console.log("Session ended successfully.");
    } catch (error) {
      console.error("endSession error:", error);
      // It's fine to not re-throw here, as this is often a "fire and forget" call on exit.
    }
  },
};
