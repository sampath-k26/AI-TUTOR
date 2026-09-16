// Hand-mirrors apps/api response shapes (see docs/04-DATA-MODEL.md). The frontend and
// backend are independently deployable (decision D6), so types are duplicated here
// rather than shared via a workspace package — acceptable at this scope (decision D3).

export interface Profile {
  id: string;
  email: string;
  role: "user" | "admin";
  createdAt: string;
}

export interface Space {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  theme: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  spaceId: string;
  ownerId: string;
  name: string;
  description: string;
  learningGoal: string;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
}
