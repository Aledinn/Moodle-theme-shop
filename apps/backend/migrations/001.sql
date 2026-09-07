CREATE DATABASE IF NOT EXISTS mydb;

USE mydb;

CREATE TABLE IF NOT EXISTS themes (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    site TEXT NOT NULL,
    author TEXT NOT NULL,
    description TEXT NOT NULL,
    version TEXT NOT NULL,
    rules JSONB NOT NULL DEFAULT '[]'::jsonb
);

