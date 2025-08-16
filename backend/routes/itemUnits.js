// backend/routes/itemUnits.js

const express = require('express');
const router  = express.Router({ mergeParams: true });
const db      = require('../db');

// GET /items/:itemId/units — list conversions for an item
router.get('/', async (req, res) => {
  const { itemId } = req.params;
  try {
    const { rows } = await db.query(
      `SELECT iu.unit_id, u.name, u.symbol, iu.to_base_qty
       FROM item_units iu
       JOIN units u ON iu.unit_id = u.id
       WHERE iu.item_id = $1`,
      [itemId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching item units:', err);
    res.status(500).json({ error: 'Failed to fetch item units' });
  }
});

// POST /items/:itemId/units — add a conversion
router.post('/', async (req, res) => {
  const { itemId } = req.params;
  const { unit_id, to_base_qty } = req.body;
  if (typeof unit_id !== 'number' || typeof to_base_qty !== 'number') {
    return res.status(400).json({ error: 'unit_id & to_base_qty (numbers) are required' });
  }
  try {
    const { rows } = await db.query(
      `INSERT INTO item_units (item_id, unit_id, to_base_qty)
       VALUES ($1,$2,$3)
       RETURNING item_id, unit_id, to_base_qty`,
      [itemId, unit_id, to_base_qty]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error creating item unit:', err);
    res.status(500).json({ error: 'Failed to create item unit' });
  }
});

// PUT /items/:itemId/units/:unitId — update conversion
router.put('/:unitId', async (req, res) => {
  const { itemId, unitId } = req.params;
  const { to_base_qty }    = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE item_units SET to_base_qty=$1
       WHERE item_id=$2 AND unit_id=$3
       RETURNING item_id, unit_id, to_base_qty`,
      [to_base_qty, itemId, unitId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Item unit not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating item unit:', err);
    res.status(500).json({ error: 'Failed to update item unit' });
  }
});

// DELETE /items/:itemId/units/:unitId — delete conversion
router.delete('/:unitId', async (req, res) => {
  const { itemId, unitId } = req.params;
  try {
    await db.query(
      'DELETE FROM item_units WHERE item_id=$1 AND unit_id=$2',
      [itemId, unitId]
    );
    res.status(204).send();
  } catch (err) {
    console.error('Error deleting item unit:', err);
    res.status(500).json({ error: 'Failed to delete item unit' });
  }
});

module.exports = router;
