import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CORE_PROFILE_SELECT,
  PROFILE_SELECT,
  selectProfileWithSchemaFallback,
} from '../data/profileFields.js';

function createClient(results, selectedColumns) {
  return {
    from(table) {
      assert.equal(table, 'profiles');

      return {
        select(columns) {
          selectedColumns.push(columns);

          return {
            eq(column, userId) {
              assert.equal(column, 'id');
              assert.equal(userId, 'user-1');

              return {
                maybeSingle() {
                  return Promise.resolve(results.shift());
                },
              };
            },
          };
        },
      };
    },
  };
}

test('loads the complete recommendation profile when Phase 20 is installed', async () => {
  const selectedColumns = [];
  const expected = { data: { major: 'computer_science' }, error: null };
  const client = createClient([expected], selectedColumns);

  const result = await selectProfileWithSchemaFallback(client, 'user-1');

  assert.deepEqual(result, expected);
  assert.deepEqual(selectedColumns, [PROFILE_SELECT]);
});

test('falls back to core profile fields when Phase 20 is missing', async () => {
  const selectedColumns = [];
  const expected = { data: { major: 'computer_science' }, error: null };
  const client = createClient([
    {
      data: null,
      error: {
        code: '42703',
        message: 'column profiles.opportunity_interests does not exist',
      },
    },
    expected,
  ], selectedColumns);

  const result = await selectProfileWithSchemaFallback(client, 'user-1');

  assert.deepEqual(result, expected);
  assert.deepEqual(selectedColumns, [
    PROFILE_SELECT,
    CORE_PROFILE_SELECT,
  ]);
});
