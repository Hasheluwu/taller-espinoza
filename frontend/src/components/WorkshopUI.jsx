import '../workshop.css'
export function Field({ label, children }) { return <label className="work-field"><span>{label}</span>{children}</label> }
export function Notice({ error, message }) { return <>{error && <p role="alert" className="work-error">{error}</p>}{message && <p role="status" className="work-success">{message}</p>}</> }
export function Panel({ title, children }) { return <section className="work-panel"><h2>{title}</h2>{children}</section> }
