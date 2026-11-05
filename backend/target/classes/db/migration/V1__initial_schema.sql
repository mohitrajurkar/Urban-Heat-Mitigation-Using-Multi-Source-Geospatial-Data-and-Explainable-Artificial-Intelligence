-- Urban Heat Mitigation DSS - initial schema (PostgreSQL 16 + PostGIS 3)
-- Applied automatically by Flyway when the Spring Boot backend starts.

CREATE EXTENSION IF NOT EXISTS postgis;

-- ---------------------------------------------------------------- users
CREATE TABLE users (
    id            BIGSERIAL PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL UNIQUE,
    email         VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    full_name     VARCHAR(120) NOT NULL,
    role          VARCHAR(20)  NOT NULL CHECK (role IN ('ADMIN', 'ANALYST', 'VIEWER')),
    enabled       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ
);

-- ---------------------------------------------------------------- study areas
CREATE TABLE study_areas (
    id             BIGSERIAL PRIMARY KEY,
    code           VARCHAR(40)  NOT NULL UNIQUE,
    name           VARCHAR(120) NOT NULL,
    city           VARCHAR(80)  NOT NULL,
    state          VARCHAR(80),
    country        VARCHAR(80),
    description    TEXT,
    boundary       geometry(Polygon, 4326) NOT NULL,
    center         geometry(Point, 4326)   NOT NULL,
    processing_epsg INTEGER     NOT NULL,
    resolution_m   INTEGER      NOT NULL CHECK (resolution_m > 0),
    cell_size_m    INTEGER      NOT NULL CHECK (cell_size_m > 0),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_study_areas_boundary ON study_areas USING GIST (boundary);

-- ---------------------------------------------------------------- datasets
CREATE TABLE datasets (
    id              BIGSERIAL PRIMARY KEY,
    ai_dataset_id   VARCHAR(64)  NOT NULL UNIQUE,
    study_area_id   BIGINT REFERENCES study_areas (id) ON DELETE SET NULL,
    name            VARCHAR(200) NOT NULL,
    data_type       VARCHAR(30)  NOT NULL,
    source          VARCHAR(300),
    collection_date VARCHAR(40),
    coverage        VARCHAR(300),
    file_format     VARCHAR(20),
    file_name       VARCHAR(255),
    file_size       BIGINT,
    is_demo         BOOLEAN      NOT NULL DEFAULT FALSE,
    is_real         BOOLEAN      NOT NULL DEFAULT TRUE,
    footprint       geometry(Polygon, 4326),
    metadata        JSONB,
    uploaded_by     BIGINT REFERENCES users (id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_datasets_type ON datasets (data_type);
CREATE INDEX idx_datasets_footprint ON datasets USING GIST (footprint);

-- ---------------------------------------------------------------- analysis runs
CREATE TABLE analysis_runs (
    id              BIGSERIAL PRIMARY KEY,
    ai_run_id       VARCHAR(64) UNIQUE,
    study_area_id   BIGINT NOT NULL REFERENCES study_areas (id) ON DELETE CASCADE,
    status          VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED')),
    current_step    VARCHAR(200),
    progress        INTEGER     NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    message         TEXT,
    is_demo         BOOLEAN     NOT NULL DEFAULT FALSE,
    parameters      JSONB,
    dataset_selection JSONB,
    preprocessing_summary JSONB,
    feature_summary JSONB,
    hotspot_summary JSONB,
    recommendation_summary JSONB,
    created_by      BIGINT REFERENCES users (id) ON DELETE SET NULL,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ
);
CREATE INDEX idx_runs_status ON analysis_runs (status, started_at DESC);

-- ---------------------------------------------------------------- geographic regions (analysis cells)
CREATE TABLE geographic_regions (
    id            BIGSERIAL PRIMARY KEY,
    run_id        BIGINT      NOT NULL REFERENCES analysis_runs (id) ON DELETE CASCADE,
    study_area_id BIGINT      NOT NULL REFERENCES study_areas (id) ON DELETE CASCADE,
    cell_index    INTEGER     NOT NULL,
    region_code   VARCHAR(30) NOT NULL,
    name          VARCHAR(120) NOT NULL,
    locality      VARCHAR(80),
    row_idx       INTEGER     NOT NULL,
    col_idx       INTEGER     NOT NULL,
    area_km2      DOUBLE PRECISION NOT NULL,
    geom          geometry(Polygon, 4326) NOT NULL,
    centroid      geometry(Point, 4326)   NOT NULL,
    CONSTRAINT uq_region_run_cell UNIQUE (run_id, cell_index)
);
CREATE INDEX idx_regions_geom ON geographic_regions USING GIST (geom);
CREATE INDEX idx_regions_run ON geographic_regions (run_id);

-- ---------------------------------------------------------------- environmental indicators
CREATE TABLE environmental_indicators (
    id                  BIGSERIAL PRIMARY KEY,
    region_id           BIGINT NOT NULL UNIQUE REFERENCES geographic_regions (id) ON DELETE CASCADE,
    run_id              BIGINT NOT NULL REFERENCES analysis_runs (id) ON DELETE CASCADE,
    lst_mean            DOUBLE PRECISION,
    lst_min             DOUBLE PRECISION,
    lst_max             DOUBLE PRECISION,
    lst_std             DOUBLE PRECISION,
    ndvi_mean           DOUBLE PRECISION CHECK (ndvi_mean IS NULL OR ndvi_mean BETWEEN -1 AND 1),
    ndbi_mean           DOUBLE PRECISION CHECK (ndbi_mean IS NULL OR ndbi_mean BETWEEN -1 AND 1),
    ndwi_mean           DOUBLE PRECISION CHECK (ndwi_mean IS NULL OR ndwi_mean BETWEEN -1 AND 1),
    albedo_mean         DOUBLE PRECISION,
    lulc_majority       INTEGER,
    lulc_majority_name  VARCHAR(60),
    lulc_fractions      JSONB,
    built_fraction      DOUBLE PRECISION,
    vegetation_fraction DOUBLE PRECISION,
    water_fraction      DOUBLE PRECISION,
    open_land_fraction  DOUBLE PRECISION,
    air_temp_max        DOUBLE PRECISION,
    relative_humidity   DOUBLE PRECISION,
    wind_speed          DOUBLE PRECISION,
    population          DOUBLE PRECISION,
    population_density  DOUBLE PRECISION,
    road_density        DOUBLE PRECISION,
    valid_pixel_pct     DOUBLE PRECISION,
    label_quality_ok    BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_indicators_run ON environmental_indicators (run_id);

-- ---------------------------------------------------------------- model evaluation
CREATE TABLE model_evaluations (
    id                 BIGSERIAL PRIMARY KEY,
    run_id             BIGINT      NOT NULL REFERENCES analysis_runs (id) ON DELETE CASCADE,
    model_name         VARCHAR(40) NOT NULL,
    task               VARCHAR(20) NOT NULL CHECK (task IN ('classification', 'regression')),
    accuracy           DOUBLE PRECISION,
    precision_macro    DOUBLE PRECISION,
    recall_macro       DOUBLE PRECISION,
    f1_macro           DOUBLE PRECISION,
    mae                DOUBLE PRECISION,
    rmse               DOUBLE PRECISION,
    r2                 DOUBLE PRECISION,
    cv_mean            DOUBLE PRECISION,
    cv_std             DOUBLE PRECISION,
    train_samples      INTEGER,
    test_samples       INTEGER,
    training_seconds   DOUBLE PRECISION,
    is_best            BOOLEAN     NOT NULL DEFAULT FALSE,
    confusion_matrix   JSONB,
    feature_importance JSONB,
    details            JSONB,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_eval_run_model_task UNIQUE (run_id, model_name, task)
);

-- ---------------------------------------------------------------- AI predictions
CREATE TABLE ai_predictions (
    id                  BIGSERIAL PRIMARY KEY,
    run_id              BIGINT      NOT NULL REFERENCES analysis_runs (id) ON DELETE CASCADE,
    region_id           BIGINT      NOT NULL REFERENCES geographic_regions (id) ON DELETE CASCADE,
    model_name          VARCHAR(40) NOT NULL,
    predicted_class     VARCHAR(20) NOT NULL,
    class_probabilities JSONB,
    predicted_lst       DOUBLE PRECISION,
    observed_class      VARCHAR(20),
    observed_lst        DOUBLE PRECISION,
    is_best_model       BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_prediction UNIQUE (region_id, model_name)
);
CREATE INDEX idx_predictions_run ON ai_predictions (run_id, model_name);

-- ---------------------------------------------------------------- SHAP explanations
CREATE TABLE shap_explanations (
    id                  BIGSERIAL PRIMARY KEY,
    run_id              BIGINT      NOT NULL REFERENCES analysis_runs (id) ON DELETE CASCADE,
    region_id           BIGINT REFERENCES geographic_regions (id) ON DELETE CASCADE,
    model_name          VARCHAR(40) NOT NULL,
    explanation_type    VARCHAR(10) NOT NULL CHECK (explanation_type IN ('GLOBAL', 'LOCAL')),
    task                VARCHAR(20),
    base_value          DOUBLE PRECISION,
    predicted_value     DOUBLE PRECISION,
    predicted_class     VARCHAR(20),
    contributions       JSONB       NOT NULL,
    class_contributions JSONB,
    explanation_text    TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_shap_run_type ON shap_explanations (run_id, explanation_type);
CREATE INDEX idx_shap_region ON shap_explanations (region_id);

-- ---------------------------------------------------------------- hotspots
CREATE TABLE hotspots (
    id                 BIGSERIAL PRIMARY KEY,
    run_id             BIGINT      NOT NULL REFERENCES analysis_runs (id) ON DELETE CASCADE,
    region_id          BIGINT      NOT NULL UNIQUE REFERENCES geographic_regions (id) ON DELETE CASCADE,
    severity           VARCHAR(20) NOT NULL CHECK (severity IN ('Low', 'Moderate', 'High', 'Very High')),
    severity_source    VARCHAR(60),
    observed_severity  VARCHAR(20),
    predicted_severity VARCHAR(20),
    is_hotspot         BOOLEAN     NOT NULL,
    lst                DOUBLE PRECISION,
    lst_anomaly        DOUBLE PRECISION,
    gi_star_z          DOUBLE PRECISION,
    gi_star_significant BOOLEAN    NOT NULL DEFAULT FALSE,
    location           geometry(Point, 4326) NOT NULL,
    detected_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hotspots_run_sev ON hotspots (run_id, severity);
CREATE INDEX idx_hotspots_location ON hotspots USING GIST (location);

-- ---------------------------------------------------------------- mitigation recommendations
CREATE TABLE mitigation_recommendations (
    id                   BIGSERIAL PRIMARY KEY,
    run_id               BIGINT      NOT NULL REFERENCES analysis_runs (id) ON DELETE CASCADE,
    hotspot_id           BIGINT      NOT NULL REFERENCES hotspots (id) ON DELETE CASCADE,
    region_id            BIGINT      NOT NULL REFERENCES geographic_regions (id) ON DELETE CASCADE,
    intervention_type    VARCHAR(30) NOT NULL,
    intervention_name    VARCHAR(80) NOT NULL,
    description          TEXT,
    reason               TEXT        NOT NULL,
    location             geometry(Point, 4326) NOT NULL,
    location_description VARCHAR(300),
    area_m2              DOUBLE PRECISION NOT NULL CHECK (area_m2 >= 0),
    quantity             DOUBLE PRECISION,
    unit                 VARCHAR(20),
    cooling_c            DOUBLE PRECISION NOT NULL,
    suitability          DOUBLE PRECISION,
    priority_level       VARCHAR(20) NOT NULL,
    cost_effectiveness_rank INTEGER,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_recs_run_type ON mitigation_recommendations (run_id, intervention_type);
CREATE INDEX idx_recs_location ON mitigation_recommendations USING GIST (location);

-- ---------------------------------------------------------------- cost estimates
CREATE TABLE cost_estimates (
    id                BIGSERIAL PRIMARY KEY,
    recommendation_id BIGINT NOT NULL UNIQUE REFERENCES mitigation_recommendations (id) ON DELETE CASCADE,
    run_id            BIGINT NOT NULL REFERENCES analysis_runs (id) ON DELETE CASCADE,
    currency          VARCHAR(5) NOT NULL DEFAULT 'INR',
    unit_cost         DOUBLE PRECISION NOT NULL,
    unit_cost_basis   VARCHAR(300),
    estimated_cost    DOUBLE PRECISION NOT NULL CHECK (estimated_cost >= 0),
    cost_low          DOUBLE PRECISION,
    cost_high         DOUBLE PRECISION,
    cost_per_degree   DOUBLE PRECISION,
    is_approximate    BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_costs_run ON cost_estimates (run_id);

-- ---------------------------------------------------------------- priority rankings
CREATE TABLE priority_rankings (
    id                        BIGSERIAL PRIMARY KEY,
    run_id                    BIGINT NOT NULL REFERENCES analysis_runs (id) ON DELETE CASCADE,
    hotspot_id                BIGINT NOT NULL UNIQUE REFERENCES hotspots (id) ON DELETE CASCADE,
    region_id                 BIGINT NOT NULL REFERENCES geographic_regions (id) ON DELETE CASCADE,
    rank                      INTEGER NOT NULL,
    score                     DOUBLE PRECISION NOT NULL CHECK (score BETWEEN 0 AND 100),
    priority_level            VARCHAR(20) NOT NULL,
    heat_score                DOUBLE PRECISION NOT NULL,
    vulnerability_score       DOUBLE PRECISION NOT NULL,
    vegetation_deficit_score  DOUBLE PRECISION NOT NULL,
    feasibility_score         DOUBLE PRECISION NOT NULL,
    cooling_benefit_score     DOUBLE PRECISION NOT NULL,
    expected_cooling_c        DOUBLE PRECISION,
    estimated_cost            DOUBLE PRECISION,
    n_interventions           INTEGER,
    weights                   JSONB NOT NULL
);
CREATE INDEX idx_rank_run ON priority_rankings (run_id, rank);

-- ---------------------------------------------------------------- reports
CREATE TABLE reports (
    id           BIGSERIAL PRIMARY KEY,
    run_id       BIGINT REFERENCES analysis_runs (id) ON DELETE CASCADE,
    title        VARCHAR(200) NOT NULL,
    file_name    VARCHAR(200) NOT NULL,
    file_size    BIGINT       NOT NULL,
    content      BYTEA        NOT NULL,
    sections     JSONB,
    generated_by BIGINT REFERENCES users (id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- application settings
CREATE TABLE app_settings (
    setting_key   VARCHAR(80) PRIMARY KEY,
    setting_value JSONB       NOT NULL,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- extra JSON summaries kept on the run for fast dashboard/report access
ALTER TABLE analysis_runs ADD COLUMN evaluation_summary JSONB;
ALTER TABLE analysis_runs ADD COLUMN shap_global JSONB;
ALTER TABLE analysis_runs ADD COLUMN layers_meta JSONB;

-- pooled sequence allocation lets Hibernate batch-insert the large result tables
ALTER SEQUENCE geographic_regions_id_seq INCREMENT BY 50;
ALTER SEQUENCE environmental_indicators_id_seq INCREMENT BY 50;
ALTER SEQUENCE ai_predictions_id_seq INCREMENT BY 50;
ALTER SEQUENCE shap_explanations_id_seq INCREMENT BY 50;
ALTER SEQUENCE hotspots_id_seq INCREMENT BY 50;
ALTER SEQUENCE mitigation_recommendations_id_seq INCREMENT BY 50;
ALTER SEQUENCE cost_estimates_id_seq INCREMENT BY 50;
ALTER SEQUENCE priority_rankings_id_seq INCREMENT BY 50;
