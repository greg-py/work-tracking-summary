import { JiraContent } from "../types";

export const extractTextFromJiraDescription = (json: JiraContent): string => {
  let text = "";
  let previousNodeType: string | null = null;

  json.content?.forEach((content) => {
    if (content.hasOwnProperty("text") && content.text) {
      text += (content.type === previousNodeType ? "" : "\n") + content.text;
      previousNodeType = content.type || null;
    }
    if (content.hasOwnProperty("content") && content.content) {
      text += extractTextFromJiraDescription(content);
    }
  });

  return text;
};
