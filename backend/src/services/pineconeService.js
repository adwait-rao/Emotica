import { Pinecone } from "@pinecone-database/pinecone";
import dotenv from "dotenv";
dotenv.config();

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

const indexName = process.env.PINECONE_INDEX_NAME || "good-in-hood";

export const ensurePineconeIndexExists = async () => {
  try {
    console.log(`Creating standard index: ${indexName}`);

    // Use known dimensions for common models
    const modelDimensions = {
      "llama-text-embed-v2": 4096,
      "multilingual-e5-large": 1024,
      "text-embedding-ada-002": 1536,
    };

    const modelName = "llama-text-embed-v2";
    const dimension = modelDimensions[modelName];

    console.log(`Using model: ${modelName} with dimension: ${dimension}`);

    await pinecone.createIndex({
      name: indexName,
      dimension: dimension,
      metric: "cosine",
      spec: {
        serverless: {
          cloud: "aws",
          region: "us-east-1",
        },
      },
    });

    console.log("Standard index created.");

    // Wait for index to be ready
    console.log("⏳ Waiting for index to be ready...");
    let indexReady = false;
    let attempts = 0;
    const maxAttempts = 30; // 5 minutes max wait time

    while (!indexReady && attempts < maxAttempts) {
      try {
        const indexStats = await pinecone.describeIndex(indexName);
        if (indexStats.status?.ready) {
          indexReady = true;
          console.log("Index is ready.");
        } else {
          console.log(
            `Index status: ${
              indexStats.status?.state || "unknown"
            }, waiting...`
          );
          await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 10 seconds
          attempts++;
        }
      } catch (error) {
        console.log("Index not available yet, waiting...");
        await new Promise((resolve) => setTimeout(resolve, 10000));
        attempts++;
      }
    }

    if (!indexReady) {
      throw new Error("Index creation timed out");
    }
  } catch (err) {
    if (
      err?.message?.includes("already exists") ||
      err?.message?.includes("ALREADY_EXISTS")
    ) {
      console.log(`Index already exists: ${indexName}`);
    } else {
      throw err;
    }
  }
};

export const getPineconeIndex = () => pinecone.index(indexName);

export const generateEmbedding = async (text) => {
  try {
    console.log(`Generating embedding for: "${text.substring(0, 50)}..."`);
    const response = await pinecone.inference.embed(
      "llama-text-embed-v2",
      [text],
      { inputType: "passage" }
    );

    if (!response.data || !response.data[0] || !response.data[0].values) {
      throw new Error("Invalid embedding response structure");
    }

    console.log(
      `Generated embedding with ${response.data[0].values.length} dimensions`
    );
    return response.data[0].values;
  } catch (error) {
    console.error("Error generating embedding:", error.message);
    throw error;
  }
};

// Convenience function to upsert text with auto-embedding
export const upsertTextWithEmbedding = async (
  id,
  text,
  additionalMetadata = {}
) => {
  try {
    const index = getPineconeIndex();
    const embedding = await generateEmbedding(text);

    await index.upsert([
      {
        id: id,
        values: embedding,
        metadata: {
          chunk_text: text,
          ...additionalMetadata,
        },
      },
    ]);

    console.log(`Upserted record with ID: ${id}`);
  } catch (error) {
    console.error(`Error upserting record ${id}:`, error.message);
    throw error;
  }
};

// Convenience function to query with text
export const queryWithText = async (queryText, topK = 5, userId = null) => {
  try {
    const index = getPineconeIndex();
    const queryEmbedding = await generateEmbedding(queryText);

    const queryObj = {
      topK: topK,
      vector: queryEmbedding,
      includeMetadata: true,
    };
    if (userId) {
      queryObj.filter = { userId };
    }

    const results = await index.query(queryObj);

    console.log(`Query completed, found ${results.matches.length} matches`);
    return results;
  } catch (error) {
    console.error("Error querying:", error.message);
    throw error;
  }
};

// Function to check index status
export const checkIndexStatus = async () => {
  try {
    const indexStats = await pinecone.describeIndex(indexName);
    console.log("Index Status:", {
      name: indexStats.name,
      dimension: indexStats.dimension,
      metric: indexStats.metric,
      status: indexStats.status,
    });
    return indexStats;
  } catch (error) {
    console.error("Error checking index status:", error.message);
    throw error;
  }
};

export const getSimilarMessages = async (text, topK = 5,userId = null) => {
  const result = await queryWithText(text, topK,userId);
  const matches = result.matches || [];

  // Extract only the relevant parts (e.g., the text and score)
  const similarMessages = matches.map((match) => ({
    text: match.metadata?.chunk_text || "",
    score: match.score,
  }));

  return similarMessages;
};


export const upsertIfNotSimilar = async (userId, text, threshold = 0.8) => {
  // Query for similar messages for this user
  const results = await queryWithText(text, 3, userId);
  const matches = results.matches || [];
  const highScore = matches.find(m => m.score >= threshold);

  if (highScore) {
    // Found a similar message, do not upsert
    return { upserted: false, similarMessages: matches };
  } else {
    // No similar message, upsert new embedding
    const id = `${userId}-${Date.now()}`;
    await upsertTextWithEmbedding(id, text, { userId });
    return { upserted: true, similarMessages: [] };
  }
};