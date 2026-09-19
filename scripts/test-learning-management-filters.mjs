import assert from 'node:assert/strict';

/**
 * Test Suite: Learning Management Filters, Search & Sort
 * Tests query builders, parameter bindings, sort mappings, and subquery selections
 * for Trainings, Exams, and Modules endpoints.
 */

console.log('🧪 Starting Learning Management Filters Test Suite...');

// ─────────────────────────────────────────────────────────────
// 1. Trainings Query Builder Tests
// ─────────────────────────────────────────────────────────────
function buildTrainingsQuery({ search = '', mediaType = 'all', usage = 'all', sort = 'created_desc', limit = 10, offset = 0 }) {
    const conditions = [];
    const conditionParams = [];

    if (search.trim()) {
        conditions.push(`t.title LIKE ?`);
        conditionParams.push(`%${search.trim()}%`);
    }

    if (mediaType === 'video') {
        conditions.push(`EXISTS (SELECT 1 FROM training_media tm WHERE tm.training_id = t.id AND tm.media_type = 'video')`);
    } else if (mediaType === 'document') {
        conditions.push(`EXISTS (SELECT 1 FROM training_media tm WHERE tm.training_id = t.id AND tm.media_type IN ('document', 'pdf'))`);
    } else if (mediaType === 'none') {
        conditions.push(`NOT EXISTS (SELECT 1 FROM training_media tm WHERE tm.training_id = t.id)`);
    }

    if (usage === 'in_module') {
        conditions.push(`EXISTS (SELECT 1 FROM module_items mi WHERE mi.item_id = t.id AND mi.item_type = 'training')`);
    } else if (usage === 'standalone') {
        conditions.push(`NOT EXISTS (SELECT 1 FROM module_items mi WHERE mi.item_id = t.id AND mi.item_type = 'training')`);
    }

    const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';

    const SORT_MAP = {
        created_desc: 't.created_at DESC',
        created_asc: 't.created_at ASC',
        title_asc: 't.title ASC',
        title_desc: 't.title DESC',
        updated_desc: 't.updated_at DESC',
    };
    const orderClause = SORT_MAP[sort] || 't.created_at DESC';

    const countSql = `SELECT COUNT(*) as total FROM trainings t${whereClause}`;
    const dataSql = `SELECT t.id, t.title, t.created_at, t.updated_at,
                    (SELECT COUNT(*) FROM training_media tm WHERE tm.training_id = t.id) AS media_count,
                    (SELECT COUNT(*) FROM module_items mi WHERE mi.item_id = t.id AND mi.item_type = 'training') AS module_count
             FROM trainings t
             ${whereClause}
             ORDER BY ${orderClause}
             LIMIT ? OFFSET ?`;

    return {
        countSql,
        dataSql,
        countParams: [...conditionParams],
        dataParams: [...conditionParams, limit, offset],
    };
}

// Test Trainings default
{
    const q = buildTrainingsQuery({});
    assert.equal(q.countParams.length, 0);
    assert.deepEqual(q.dataParams, [10, 0]);
    assert(!q.countSql.includes('WHERE'), 'Default should not have WHERE clause');
    assert(q.dataSql.includes('ORDER BY t.created_at DESC'), 'Default sort should be created_at DESC');
}

// Test Trainings with search & filters
{
    const q = buildTrainingsQuery({ search: 'K3', mediaType: 'video', usage: 'in_module', sort: 'title_asc', limit: 20, offset: 40 });
    assert.equal(q.countParams.length, 1);
    assert.equal(q.countParams[0], '%K3%');
    assert.deepEqual(q.dataParams, ['%K3%', 20, 40]);
    assert(q.countSql.includes('t.title LIKE ?'));
    assert(q.countSql.includes('media_type = \'video\''));
    assert(q.countSql.includes('item_type = \'training\''));
    assert(q.dataSql.includes('ORDER BY t.title ASC'));
}

// Test Trainings media none & standalone
{
    const q = buildTrainingsQuery({ mediaType: 'none', usage: 'standalone' });
    assert(q.countSql.includes('NOT EXISTS (SELECT 1 FROM training_media'));
    assert(q.countSql.includes('NOT EXISTS (SELECT 1 FROM module_items'));
}

console.log('✅ Trainings query builder tests passed.');

// ─────────────────────────────────────────────────────────────
// 2. Exams Query Builder Tests
// ─────────────────────────────────────────────────────────────
function buildExamsQuery({ search = '', examType = 'all', allowRemedial = 'all', questionStatus = 'all', sort = 'created_desc', limit = 10, offset = 0 }) {
    const conditions = [];
    const conditionParams = [];

    if (search.trim()) {
        conditions.push(`e.title LIKE ?`);
        conditionParams.push(`%${search.trim()}%`);
    }

    if (examType === 'regular') {
        conditions.push(`NOT EXISTS (SELECT 1 FROM exams parent WHERE parent.remedial_exam_id = e.id)`);
    } else if (examType === 'remedial') {
        conditions.push(`EXISTS (SELECT 1 FROM exams parent WHERE parent.remedial_exam_id = e.id)`);
    }

    if (allowRemedial === 'yes') {
        conditions.push(`e.allow_remedial = 1`);
    } else if (allowRemedial === 'no') {
        conditions.push(`(e.allow_remedial = 0 OR e.allow_remedial IS NULL)`);
    }

    if (questionStatus === 'has_questions') {
        conditions.push(`EXISTS (SELECT 1 FROM questions q WHERE q.exam_id = e.id)`);
    } else if (questionStatus === 'no_questions') {
        conditions.push(`NOT EXISTS (SELECT 1 FROM questions q WHERE q.exam_id = e.id)`);
    }

    const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';

    const SORT_MAP = {
        created_desc: 'e.created_at DESC',
        created_asc: 'e.created_at ASC',
        title_asc: 'e.title ASC',
        title_desc: 'e.title DESC',
        passing_grade_desc: 'e.passing_grade DESC, e.title ASC',
        passing_grade_asc: 'e.passing_grade ASC, e.title ASC',
        duration_desc: 'e.duration_minutes DESC, e.title ASC',
        duration_asc: 'e.duration_minutes ASC, e.title ASC',
        questions_desc: 'question_count DESC, e.title ASC',
    };
    const orderClause = SORT_MAP[sort] || 'e.created_at DESC';

    const countSql = `SELECT COUNT(*) as total FROM exams e${whereClause}`;
    const dataSql = `SELECT e.id, e.title, e.duration_minutes, e.passing_grade, e.allow_remedial, e.max_attempts, 
                    e.remedial_exam_id, re.title AS remedial_exam_title, e.created_at,
                    (SELECT COUNT(*) FROM questions q WHERE q.exam_id = e.id) AS question_count,
                    (SELECT COUNT(*) FROM module_items mi WHERE mi.item_id = e.id AND mi.item_type = 'exam') AS module_count,
                    EXISTS (SELECT 1 FROM exams parent WHERE parent.remedial_exam_id = e.id) AS is_remedial_package
             FROM exams e 
             LEFT JOIN exams re ON e.remedial_exam_id = re.id 
             ${whereClause}
             ORDER BY ${orderClause} 
             LIMIT ? OFFSET ?`;

    return {
        countSql,
        dataSql,
        countParams: [...conditionParams],
        dataParams: [...conditionParams, limit, offset],
    };
}

// Test Exams default
{
    const q = buildExamsQuery({});
    assert.equal(q.countParams.length, 0);
    assert.deepEqual(q.dataParams, [10, 0]);
    assert(!q.countSql.includes('WHERE'));
    assert(q.dataSql.includes('ORDER BY e.created_at DESC'));
}

// Test Exams with filters and custom sort
{
    const q = buildExamsQuery({
        search: 'Sertifikasi',
        examType: 'regular',
        allowRemedial: 'yes',
        questionStatus: 'has_questions',
        sort: 'passing_grade_desc',
        limit: 15,
        offset: 30,
    });
    assert.equal(q.countParams.length, 1);
    assert.equal(q.countParams[0], '%Sertifikasi%');
    assert.deepEqual(q.dataParams, ['%Sertifikasi%', 15, 30]);
    assert(q.countSql.includes('e.title LIKE ?'));
    assert(q.countSql.includes('NOT EXISTS (SELECT 1 FROM exams parent WHERE parent.remedial_exam_id = e.id)'));
    assert(q.countSql.includes('e.allow_remedial = 1'));
    assert(q.countSql.includes('EXISTS (SELECT 1 FROM questions q WHERE q.exam_id = e.id)'));
    assert(q.dataSql.includes('ORDER BY e.passing_grade DESC, e.title ASC'));
}

// Test Exams remedial package and no remedial
{
    const q = buildExamsQuery({ examType: 'remedial', allowRemedial: 'no', questionStatus: 'no_questions', sort: 'questions_desc' });
    assert(q.countSql.includes('EXISTS (SELECT 1 FROM exams parent WHERE parent.remedial_exam_id = e.id)'));
    assert(q.countSql.includes('(e.allow_remedial = 0 OR e.allow_remedial IS NULL)'));
    assert(q.countSql.includes('NOT EXISTS (SELECT 1 FROM questions q WHERE q.exam_id = e.id)'));
    assert(q.dataSql.includes('ORDER BY question_count DESC, e.title ASC'));
}

console.log('✅ Exams query builder tests passed.');

// ─────────────────────────────────────────────────────────────
// 3. Modules Query Builder Tests
// ─────────────────────────────────────────────────────────────
function buildModulesQuery({ search = '', sequence = 'all', composition = 'all', sort = 'created_desc', limit = 10, offset = 0 }) {
    const conditions = [];
    const conditionParams = [];

    if (search.trim()) {
        conditions.push(`(m.title LIKE ? OR m.description LIKE ?)`);
        conditionParams.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    if (sequence === 'enforced') {
        conditions.push(`m.enforce_sequence = 1`);
    } else if (sequence === 'free') {
        conditions.push(`(m.enforce_sequence = 0 OR m.enforce_sequence IS NULL)`);
    }

    if (composition === 'complete') {
        conditions.push(`EXISTS (SELECT 1 FROM module_items mi WHERE mi.module_id = m.id AND mi.item_type = 'training') AND EXISTS (SELECT 1 FROM module_items mi WHERE mi.module_id = m.id AND mi.item_type = 'exam')`);
    } else if (composition === 'training_only') {
        conditions.push(`EXISTS (SELECT 1 FROM module_items mi WHERE mi.module_id = m.id AND mi.item_type = 'training') AND NOT EXISTS (SELECT 1 FROM module_items mi WHERE mi.module_id = m.id AND mi.item_type = 'exam')`);
    } else if (composition === 'exam_only') {
        conditions.push(`EXISTS (SELECT 1 FROM module_items mi WHERE mi.module_id = m.id AND mi.item_type = 'exam') AND NOT EXISTS (SELECT 1 FROM module_items mi WHERE mi.module_id = m.id AND mi.item_type = 'training')`);
    } else if (composition === 'empty') {
        conditions.push(`NOT EXISTS (SELECT 1 FROM module_items mi WHERE mi.module_id = m.id)`);
    }

    const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';

    const SORT_MAP = {
        created_desc: 'm.created_at DESC',
        created_asc: 'm.created_at ASC',
        title_asc: 'm.title ASC',
        title_desc: 'm.title DESC',
        items_desc: 'item_count DESC, m.title ASC',
    };
    const orderClause = SORT_MAP[sort] || 'm.created_at DESC';

    const countSql = `SELECT COUNT(*) as total FROM modules m${whereClause}`;
    const dataSql = `SELECT m.id, m.title, m.description, m.enforce_sequence, m.created_at,
                    (SELECT COUNT(*) FROM module_items mi WHERE mi.module_id = m.id) AS item_count,
                    (SELECT COUNT(*) FROM module_items mi WHERE mi.module_id = m.id AND mi.item_type = 'training') AS training_count,
                    (SELECT COUNT(*) FROM module_items mi WHERE mi.module_id = m.id AND mi.item_type = 'exam') AS exam_count,
                    (SELECT COUNT(*) FROM sessions s WHERE s.module_id = m.id) AS session_count
             FROM modules m
             ${whereClause}
             ORDER BY ${orderClause}
             LIMIT ? OFFSET ?`;

    return {
        countSql,
        dataSql,
        countParams: [...conditionParams],
        dataParams: [...conditionParams, limit, offset],
    };
}

// Test Modules default
{
    const q = buildModulesQuery({});
    assert.equal(q.countParams.length, 0);
    assert.deepEqual(q.dataParams, [10, 0]);
    assert(!q.countSql.includes('WHERE'));
    assert(q.dataSql.includes('ORDER BY m.created_at DESC'));
}

// Test Modules search (binds 2 parameters: title and description)
{
    const q = buildModulesQuery({ search: 'K3 Dasar', sequence: 'enforced', composition: 'complete', sort: 'items_desc' });
    assert.equal(q.countParams.length, 2);
    assert.equal(q.countParams[0], '%K3 Dasar%');
    assert.equal(q.countParams[1], '%K3 Dasar%');
    assert.deepEqual(q.dataParams, ['%K3 Dasar%', '%K3 Dasar%', 10, 0]);
    assert(q.countSql.includes('(m.title LIKE ? OR m.description LIKE ?)'));
    assert(q.countSql.includes('m.enforce_sequence = 1'));
    assert(q.countSql.includes('item_type = \'training\'') && q.countSql.includes('item_type = \'exam\''));
    assert(q.dataSql.includes('ORDER BY item_count DESC, m.title ASC'));
}

// Test Modules composition variations
{
    const q1 = buildModulesQuery({ sequence: 'free', composition: 'training_only' });
    assert(q1.countSql.includes('(m.enforce_sequence = 0 OR m.enforce_sequence IS NULL)'));
    assert(q1.countSql.includes('NOT EXISTS (SELECT 1 FROM module_items mi WHERE mi.module_id = m.id AND mi.item_type = \'exam\')'));

    const q2 = buildModulesQuery({ composition: 'exam_only' });
    assert(q2.countSql.includes('NOT EXISTS (SELECT 1 FROM module_items mi WHERE mi.module_id = m.id AND mi.item_type = \'training\')'));

    const q3 = buildModulesQuery({ composition: 'empty' });
    assert(q3.countSql.includes('NOT EXISTS (SELECT 1 FROM module_items mi WHERE mi.module_id = m.id)'));
}

console.log('✅ Modules query builder tests passed.');
console.log('🎉 ALL LEARNING MANAGEMENT FILTER TESTS PASSED SUCCESSFULLY!');
