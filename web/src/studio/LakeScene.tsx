import { savedDemo } from "../mode";
export function LakeScene({
  lakeName,
  count,
  savedCount = 0,
  onExplore,
}: {
  lakeName?: string;
  count: number;
  savedCount?: number;
  onExplore: () => void;
}) {
  return (
    <section className="lake-scene" aria-label="Data lake overview">
      <div className="lake-overview-title">
        <div>
          <h2>{lakeName || "Your data lake"}</h2>
          <p>
            {count
              ? `${count} staged files. Preview and save them below.`
              : savedCount ? `${savedCount} saved sources. Inspect your lake below or add more files.` : "Start with CSV files and text documents. IDUN will find the connections."}
          </p>
        </div>
        <span className="session-badge">{savedDemo ? "Synthetic example" : "Local storage"}</span>
      </div>
      <ol className="compact-workflow">
        <li>
          <b>1</b>
          <span>
            Add sources<small>Files or nested folders</small>
          </span>
        </li>
        <li>
          <b>2</b>
          <span>
            Discover & integrate<small>Find connections through text</small>
          </span>
        </li>
        <li>
          <b>3</b>
          <span>
            Augment & inspect<small>Trace values to their evidence</small>
          </span>
        </li>
      </ol>
      <div className="example-entry">
        <span>Explore the sources and connections in this lake.</span>
        <button onClick={onExplore}>Explore discovery ↗</button>
      </div>
    </section>
  );
}
