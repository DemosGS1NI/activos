import { writable } from "svelte/store";

const menuStore = writable([]);

export function setMenu(items) {
  if (!Array.isArray(items)) {
    menuStore.set([]);
    return;
  }
  menuStore.set(items);
}

export function clearMenu() {
  menuStore.set([]);
}

export default menuStore;
