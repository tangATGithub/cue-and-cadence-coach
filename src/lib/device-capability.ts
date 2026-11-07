/** One private capability shared by calls and history, never included in URLs. */
export function getDeviceCapability() {
  let capability = localStorage.getItem('coach-device-capability');
  if (!capability || !/^[a-f0-9]{64}$/.test(capability)) {
    capability = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('');
    localStorage.setItem('coach-device-capability', capability);
  }
  return capability;
}