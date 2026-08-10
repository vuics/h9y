

class InterstitialFetcher:
    """A site that answers the crawler with a block page instead of content."""

    async def fetch(self, url):
        return FetchedPage(
            requested_url=url,
            final_url=url,
            title="Pardon Our Interruption",
            text="Pardon Our Interruption. Please verify you are a human.",
            content_type="text/html",
            http_status=200,
            sha256="c" * 64,
        )


@pytest.mark.asyncio
async def test_blocked_page_with_on_subject_snippet_is_analyzed_not_skipped():
    service = _service()
    service.fetcher = InterstitialFetcher()
    extractor = LongTextFailingExtractor()
    service.extractor = extractor

    run = await service.start(
        card_id=7,
        initiated_by_principal_key="USER:42",
        max_results=14,
    )

    acme = next(source for source in run.sources if "acme.example" in source.url)
    assert "skipped_no_subject_match" not in acme.extraction_warnings
    assert "page_unusable_using_search_snippet" in acme.extraction_warnings
    assert acme.fetch_status == "SEARCH_SNIPPET_ONLY"
    assert acme.claims


class RecoveringExtractor:
    """Fail once like an exhausted run budget, then succeed on retry."""

    name = "recovering"

    def __init__(self):
        self.calls = 0

    async def extract(
        self,
        text,
        *,
        url,
        title,
        source_id,
        requested_cas,
        requested_product_name,
    ):
        self.calls += 1
        if self.calls <= 2:
            raise RuntimeError("model busy")
        if "acetone CAS 67-64-1" not in text:
            return []
        return [
            GroundedCompany(
                canonical_name="Acme Chemical Ltd",
                proposed_source_type=SourceType.OFFICIAL_COMPANY,
                claims=[
                    _claim(
                        source_id,
                        text,
                        EvidenceCategory.PRODUCT_MATCH,
                        "acetone CAS 67-64-1",
                    )
                ],
            )
        ]


@pytest.mark.asyncio
async def test_single_source_can_be_reanalyzed_without_repeating_the_run():
    service = _service()
    service.search_backend = type("OneHit", (), {
        "search": staticmethod(lambda query, *, count, result_kind: _one_acme_hit(query)),
    })()
    service.extractor = RecoveringExtractor()

    run = await service.start(
        card_id=7,
        initiated_by_principal_key="USER:42",
        max_results=14,
    )
    failed = run.sources[0]
    assert failed.claims == []
    assert run.candidates == []
    assert any(error.endswith(":SOURCE_ANALYSIS_FAILED") for error in run.errors)

    retried = await service.retry_source(run_id=run.run_id, source_id=failed.source_id)

    assert len(retried.sources) == 1
    assert retried.sources[0].claims
    assert retried.candidates
    # The stale failure must not linger once the source produced evidence.
    assert not any(error.endswith(":SOURCE_ANALYSIS_FAILED") for error in retried.errors)


async def _one_acme_hit(query):
    return [
        SearchHit(
            query=query,
            title="Acme Acetone",
            url="https://acme.example/products/acetone",
            snippet="Acme Chemical manufactures acetone CAS 67-64-1.",
            rank=1,
        )
    ]


@pytest.mark.asyncio
async def test_retry_keeps_an_existing_specialist_decision():
    service = _service()
    run = await service.start(
        card_id=7,
        initiated_by_principal_key="USER:42",
        max_results=14,
    )
    candidate_id = run.candidates[0].candidate_id
    await service.review_candidate(
        run_id=run.run_id,
        candidate_id=candidate_id,
        decision="VERIFIED_MANUFACTURER",
        note="Проверены официальный каталог и разрешение регулятора.",
        actor_principal_key="USER:specialist",
    )

    retried = await service.retry_source(
        run_id=run.run_id, source_id=run.sources[0].source_id
    )

    survivor = next(
        item for item in retried.candidates if item.candidate_id == candidate_id
    )
    assert survivor.review_decision == CandidateReviewDecision.VERIFIED_MANUFACTURER
    assert survivor.review_history[-1].actor_principal_key == "USER:specialist"


@pytest.mark.asyncio
async def test_run_uses_the_supplied_query_plan():
    service = _service()

    run = await service.start(
        card_id=7,
        initiated_by_principal_key="USER:42",
        max_results=14,
        query_plan=['"67-64-1" environmental permit'],
    )

    assert run.query_plan == ['"67-64-1" environmental permit']

    with pytest.raises(SourcingError) as empty:
        await service.start(
            card_id=7,
            initiated_by_principal_key="USER:42",
            query_plan=["   "],
        )
    assert empty.value.code == "SOURCING_QUERY_PLAN_EMPTY"
