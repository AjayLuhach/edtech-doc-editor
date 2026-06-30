import { FaGithub, FaLinkedin, FaGlobe } from "react-icons/fa";

// Submission identity required by the assignment.
const LINKS = [
  { href: "https://github.com/AjayLuhach", label: "GitHub", Icon: FaGithub },
  { href: "https://www.linkedin.com/in/ajayluhach7", label: "LinkedIn", Icon: FaLinkedin },
  { href: "https://ajayluhach.in/", label: "Website", Icon: FaGlobe },
];

export default function Footer() {
  return (
    <footer className="border-t border-black/10 px-4 py-4 text-sm text-neutral-500 dark:border-white/10">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 sm:flex-row">
        <span>Built by Ajay Kumar</span>
        <nav className="flex items-center gap-4">
          {LINKS.map(({ href, label, Icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              className="flex items-center gap-1.5 transition-colors hover:text-neutral-900 dark:hover:text-neutral-100"
            >
              <Icon aria-hidden className="h-4 w-4" />
              <span>{label}</span>
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
