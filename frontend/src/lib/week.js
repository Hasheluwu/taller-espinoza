// Local calendar arithmetic: never shifts dates through UTC.
export function shiftDate(day, amount) {
 const value = new Date(`${day}T12:00:00`)
 value.setDate(value.getDate() + amount)
 return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`
}
export function weekStart(day) {
 const weekday = new Date(`${day}T12:00:00`).getDay()
 return shiftDate(day,-((weekday+6)%7))
}
export function weekDays(day) {return Array.from({length:7},(_,i)=>shiftDate(day,i))}
