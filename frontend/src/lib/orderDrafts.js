import { workshopApi as api } from './workshopApi'

// Unfinished order registrations, kept on the server so they can be resumed from any page.
const kind = particular => particular ? 'particular' : 'seguro'

export function saveOrderDraft({ particular, vehiculo, paso, datos }) {
  if (!vehiculo?.id) return Promise.resolve()
  return api('/api/ordenes-borrador', 'PUT', { tipo: kind(particular), id_vehiculo: vehiculo.id, paso, datos }).catch(() => {
    // Saving a draft must never interrupt the registration itself.
  })
}

export function deleteOrderDraft({ particular, vehiculo }) {
  if (!vehiculo?.id) return Promise.resolve()
  return api(`/api/ordenes-borrador?${new URLSearchParams({ tipo: kind(particular), id_vehiculo: vehiculo.id })}`, 'DELETE')
}

export const listOrderDrafts = scope => api(`/api/ordenes-borrador?tipo=${scope}`)

// Route and navigation state that reopen a draft at the step where it was left.
export async function resumeTarget(draft) {
  const particular = draft.tipo === 'particular'
  const { cliente, vehiculo, form, id_presupuesto } = draft.datos || {}
  if (draft.paso === 'presupuesto' && !particular) return ['/ordenes/nueva/presupuesto', { cliente, vehiculo }]
  const presupuesto = id_presupuesto ? await api(`/api/proformas/${id_presupuesto}`) : undefined
  return ['/ordenes/nueva/orden', { cliente, vehiculo, presupuesto, particular, borrador: form }]
}
