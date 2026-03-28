import Database from 'better-sqlite3';
import path from 'path';

// Local database file path
const dbPath = path.resolve(__dirname, '../../glow_logic.db');
const db = new Database(dbPath);

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    data TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

export interface ProjectListing {
    id: number;
    name: string;
    updated_at: string;
}

export const saveProject = (name: string, data: any) => {
    const jsonData = JSON.stringify(data);
    const stmt = db.prepare('INSERT OR REPLACE INTO projects (id, name, data, updated_at) VALUES ((SELECT id FROM projects WHERE name = ?), ?, ?, CURRENT_TIMESTAMP)');
    const result = stmt.run(name, name, jsonData);
    return result.lastInsertRowid;
};

export const getProjects = (): ProjectListing[] => {
    const stmt = db.prepare('SELECT id, name, updated_at FROM projects ORDER BY updated_at DESC');
    return stmt.all() as ProjectListing[];
};

export const getProjectById = (id: number) => {
    const stmt = db.prepare('SELECT * FROM projects WHERE id = ?');
    const project = stmt.get(id) as any;
    if (project) {
        project.data = JSON.parse(project.data);
    }
    return project;
};

export const deleteProject = (id: number) => {
    const stmt = db.prepare('DELETE FROM projects WHERE id = ?');
    return stmt.run(id);
};

export default db;
