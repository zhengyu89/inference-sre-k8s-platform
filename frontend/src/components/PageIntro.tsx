import type { ReactNode } from "react";

interface PageIntroProps {
  children: ReactNode;
}

// One-line "what is this page for" blurb, rendered right under a page's <h1>.
// Keeps the user-guide copy in one place/style instead of ad-hoc <p> tags per page.
export function PageIntro({ children }: PageIntroProps) {
  return <p className="page-intro">{children}</p>;
}
