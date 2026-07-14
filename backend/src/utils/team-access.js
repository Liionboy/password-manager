async function getTeamMembership(db, teamId, userId) {
  if (!teamId) return null;
  return db.prepare(
    'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2'
  ).get(teamId, userId);
}

function canManageTeamResource(membership) {
  return Boolean(membership && ['owner', 'admin'].includes(membership.role));
}

module.exports = { getTeamMembership, canManageTeamResource };
