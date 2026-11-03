import ReactMarkdown from "react-markdown";

// Lesson scripts, from the repo's markdown. react-markdown renders no raw
// HTML, so a stray <script> in a lesson file stays text.
export function Markdown({ children }: { children: string }) {
  return (
    <div className="script">
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}
