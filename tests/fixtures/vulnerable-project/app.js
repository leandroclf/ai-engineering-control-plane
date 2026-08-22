const fixtureToken = "AICP_FAKE_SECRET_acceptance_only";

export function unsafeLookup(db, userInput) {
  return db.query(`SELECT * FROM users WHERE name = '${userInput}'`);
}

export { fixtureToken };
