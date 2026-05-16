import { AppShell } from "@/components/app-shell";
import { SettingsHeader, SettingsTabs } from "@/components/settings/settings-tabs";
import { requireTenant } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const courses = [
  {
    title: "HyperOptimal Metrics Library",
    description: "Set up the source-of-truth dashboard, benchmarks, and weekly operating rhythm.",
    lessons: 8,
    tone: "gold",
    href: "#lesson-1",
  },
  {
    title: "Dashboard Setup",
    description: "Choose the metrics that matter most and keep each view focused on decisions.",
    lessons: 6,
    tone: "blue",
    href: "#lesson-1",
  },
  {
    title: "Constraint Reviews",
    description: "Read benchmark gaps, identify the biggest constraint, and run one weekly fix.",
    lessons: 5,
    tone: "green",
    href: "#lesson-1",
  },
  {
    title: "Team Operating Cadence",
    description: "Use team access, scheduled reports, Slack, and Telegram to keep everyone aligned.",
    lessons: 4,
    tone: "purple",
    href: "#lesson-1",
  },
];

const lessons = [
  "Build the source of truth",
  "Pick your most important metrics",
  "Read benchmark gaps",
  "Use Slack and Telegram",
];

export default async function SettingsLearningPage() {
  const { tenant } = await requireTenant();

  return (
    <AppShell active="settings-learning" tenantName={tenant.name}>
      <SettingsHeader title="Learning" />
      <SettingsTabs active="learning" />

      <section className="settings-learning-page">
        <div className="learning-course-stack">
          {courses.map((course) => (
            <article className="settings-course-card" key={course.title}>
              <div className={`settings-course-art ${course.tone}`}>
                <span>HyperOptimal</span>
                <strong>Metrics Learn</strong>
              </div>
              <div className="settings-course-copy">
                <h2>{course.title}</h2>
                <p>{course.description}</p>
                <div className="settings-course-progress">
                  <span />
                </div>
                <small>0 of {course.lessons} lessons complete</small>
              </div>
              <a className="settings-course-action" href={course.href}>
                <span>Get Started</span>
                <strong>&gt;</strong>
              </a>
            </article>
          ))}
        </div>

        <section className="settings-lesson-panel" id="lesson-1">
          <div className="settings-lesson-intro">
            <a href="#top">Back to Learn</a>
            <p>Master the setup patterns that keep HyperOptimal Metrics clean, current, and useful for the whole team.</p>
            <span>{lessons.length} lessons</span>
          </div>
          <article className="settings-video-lesson">
            <div className="settings-video-frame">
              <iframe
                src="https://www.youtube-nocookie.com/embed/ysz5S6PUM-U"
                title="HyperOptimal Metrics lesson"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
            <div className="settings-video-copy">
              <span>Lesson 01</span>
              <h2>{lessons[0]}</h2>
              <div className="settings-course-progress">
                <span />
              </div>
            </div>
          </article>
          {lessons.slice(1).map((lesson, index) => (
            <article className="settings-video-lesson compact" key={lesson}>
              <div className="settings-lesson-thumb">Lesson {index + 2}</div>
              <div className="settings-video-copy">
                <span>Lesson {String(index + 2).padStart(2, "0")}</span>
                <h2>{lesson}</h2>
                <div className="settings-course-progress">
                  <span />
                </div>
              </div>
            </article>
          ))}
        </section>
      </section>
    </AppShell>
  );
}
