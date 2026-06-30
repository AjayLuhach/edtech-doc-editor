// Transaction/update origins so persistence and bindings can tell where a change came from.
export const ORIGIN_USER = "user"; // local edit in this tab
export const ORIGIN_REMOTE = "remote"; // pulled from the server
export const ORIGIN_LOAD = "load"; // replay of locally stored updates
export const ORIGIN_RESTORE = "restore"; // version restore applied as a forward edit (local, pushable)
