import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const apiClientMock = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));
vi.mock("../../src/lib/apiClient", () => ({ apiClient: apiClientMock, ApiError: class ApiError extends Error {} }));

const useProjectContextMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/routes/projects/ProjectLayout", () => ({ useProjectContext: useProjectContextMock }));

const { QuizTab } = await import("../../src/routes/projects/tabs/QuizTab");

const PROJECT = { id: "proj-1", name: "Test Project" };

const MCQ_QUESTION = {
  id: "q1",
  type: "mcq" as const,
  difficulty: 2,
  prompt: "What does gradient descent minimize?",
  options: ["A loss function", "A dataset", "A learning rate", "A neural network"],
};

function click(el: Element) {
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

describe("QuizTab", () => {
  it("walks the full start -> answer -> result -> finish flow for an MCQ question", async () => {
    useProjectContextMock.mockReturnValue(PROJECT);
    apiClientMock.post.mockImplementation((path: string) => {
      if (path === `/projects/${PROJECT.id}/quizzes`) return Promise.resolve({ quiz: { id: "quiz-1", projectId: PROJECT.id, status: "in_progress" } });
      if (path.endsWith("/next-question")) return Promise.resolve({ question: MCQ_QUESTION });
      if (path.endsWith("/answer")) {
        return Promise.resolve({
          response: { id: "resp-1" },
          evaluation: { correctIndex: 0, submittedIndex: 0, isCorrect: true },
          masteryLevel: 65,
          trend: "improving",
        });
      }
      if (path.endsWith("/finish")) return Promise.resolve({ completed: true });
      return Promise.reject(new Error(`Unexpected path: ${path}`));
    });

    render(<QuizTab />);

    click(screen.getByRole("button", { name: /start quiz/i }));

    await waitFor(() => expect(screen.getByText(MCQ_QUESTION.prompt)).toBeInTheDocument());

    click(screen.getByRole("radio", { name: MCQ_QUESTION.options[0] }));
    click(screen.getByRole("button", { name: /submit answer/i }));

    await waitFor(() => expect(screen.getByText("Correct.")).toBeInTheDocument());
    expect(screen.getByText(/mastery now 65%/i)).toBeInTheDocument();

    click(screen.getByRole("button", { name: /finish quiz/i }));

    await waitFor(() => expect(screen.getByText(/quiz completed/i)).toBeInTheDocument());
    expect(apiClientMock.post).toHaveBeenCalledWith(`/projects/${PROJECT.id}/quizzes/quiz-1/finish`);
  });

  it("shows a no-concepts message instead of a question when the project has no concepts yet", async () => {
    useProjectContextMock.mockReturnValue(PROJECT);
    apiClientMock.post.mockImplementation((path: string) => {
      if (path === `/projects/${PROJECT.id}/quizzes`) return Promise.resolve({ quiz: { id: "quiz-2", projectId: PROJECT.id, status: "in_progress" } });
      if (path.endsWith("/next-question")) return Promise.resolve({ noConceptsAvailable: true });
      return Promise.reject(new Error(`Unexpected path: ${path}`));
    });

    render(<QuizTab />);
    click(screen.getByRole("button", { name: /start quiz/i }));

    await waitFor(() => expect(screen.getByText(/no concepts available yet/i)).toBeInTheDocument());
  });
});
