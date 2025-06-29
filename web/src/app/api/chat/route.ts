import { NextRequest, NextResponse } from "next/server"; // Import necessary types

type ResponseData = {
  message: Object; // Consider making this more specific, e.g., string or { [key: string]: any }
};

// Remove 'default' here
export async function POST(req: NextRequest) {
  // Explicitly type 'req' as NextRequest
  try {
    const { token, message, userId } = await req.json(); // Destructure token and message

    // You might want to validate 'token' and 'message' here before proceeding
    const data = await fetch(
      `https://0a07-103-241-82-246.ngrok-free.app/chat/chat`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`, // Use the destructured 'token'
        },
        body: JSON.stringify({ message: message, userId }), // Use the destructured 'message'
      }
    );
    console.log(token);

    // Always check for response.ok when fetching
    if (!data.ok) {
      const errorBody = await data.json();
      console.error("External API error:", errorBody);
      // Return an appropriate error response to the client
      return NextResponse.json(
        { error: "Failed to forward message", details: errorBody },
        { status: data.status }
      );
    }

    const responseData = await data.json(); // Get the JSON response from your external API
    console.log("External API response:", responseData);

    // Return the data from the external API to your client
    return NextResponse.json({ success: true, data: responseData });
  } catch (error) {
    console.error("Error in POST /api/chat:", error);
    // Return a generic error message for internal server errors
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// You can optionally define other HTTP methods here if needed, e.g.,
/*
export async function GET(req: NextRequest) {
  return NextResponse.json({ message: "GET request received!" });
}
*/
