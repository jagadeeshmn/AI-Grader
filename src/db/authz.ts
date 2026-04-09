import { eq } from "drizzle-orm";
import db from "@/db/index";
import { assignments } from "@/db/schema";

export const authorizeUserToEditArticle = async function authorizeArticle(
  loggedInUserId: string,
  articleId: number
): Promise<boolean> {
  const response = await db
    .select({
      authorId: assignments.authorId,
    })
    .from(assignments)
    .where(eq(assignments.id, articleId));

  if (!response.length) {
    return false;
  }

  return response[0].authorId === loggedInUserId;
};