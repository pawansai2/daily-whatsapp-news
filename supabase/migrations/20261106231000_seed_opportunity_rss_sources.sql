INSERT INTO public.opportunity_sources (
    name,
    category,
    base_url,
    source_type,
    collection_method,
    supported_categories,
    supported_domains,
    rate_limit_seconds,
    notes
)
VALUES
    (
        'NASA Learning Resources',
        'Government and education',
        'https://www.nasa.gov/learning-resources/feed/',
        'official',
        'rss',
        ARRAY['education', 'research']::TEXT[],
        ARRAY['space', 'engineering', 'science']::TEXT[],
        600,
        'Official NASA feed. Only items with explicit opportunity cues are retained; source facts remain pending verification.'
    ),
    (
        'European Space Agency News',
        'Government and research',
        'https://www.esa.int/rss/news.en.rss',
        'official',
        'rss',
        ARRAY['research', 'innovation']::TEXT[],
        ARRAY['space', 'engineering', 'science']::TEXT[],
        600,
        'Official ESA RSS feed. General news is not treated as an opportunity unless the announcement has explicit application or participation cues.'
    ),
    (
        'Innovate UK Activity',
        'Government and funding',
        'https://www.gov.uk/government/organisations/innovate-uk.atom',
        'official',
        'rss',
        ARRAY['funding', 'grants', 'innovation']::TEXT[],
        ARRAY['engineering', 'science', 'technology']::TEXT[],
        600,
        'Official GOV.UK Atom feed for Innovate UK activity. Geographic eligibility is not inferred from source identity.'
    );
