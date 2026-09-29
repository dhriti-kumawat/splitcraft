/** The link an invitee opens to join a workspace. */
export function inviteLink(token: string): string {
  return `${window.location.origin}/invite/${token}`;
}
