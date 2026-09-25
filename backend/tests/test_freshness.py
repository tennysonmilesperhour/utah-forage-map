from datetime import datetime, timedelta
import json
import unittest
from unittest.mock import patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.models import SourceSync, Species
from app.freshness import observation_freshness
from app.plant_catalogue import PLANTS, RECORD_PLANTS
from crawler.inaturalist import run_incremental_import, fetch_observations, INCREMENTAL_SOURCE

class IncrementalTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()
        self.db.add(Species(common_name="Oyster", latin_name="Pleurotus ostreatus", inaturalist_taxon_id=48494))
        self.db.commit()
        self.now = datetime(2026, 9, 25, 11)
    def tearDown(self):
        self.db.close()
        self.engine.dispose()
    def test_resume_does_not_advance_coverage_until_complete_or_retire(self):
        with patch('crawler.inaturalist.fetch_observations', return_value=([], 4000, False, 123)) as fetch, patch('crawler.inaturalist.retire_missing_observations') as retire:
            first = run_incremental_import(self.db, client=object(), now=self.now)
            self.assertEqual(first['status'], 'in_progress')
            self.assertEqual(observation_freshness(self.db, self.now)['status'], 'stale')
            original_since = fetch.call_args.kwargs['updated_since']
            fetch.return_value = ([], 1, True, None)
            run_incremental_import(self.db, client=object(), now=self.now + timedelta(hours=2))
            self.assertEqual(fetch.call_args.kwargs['cursor'], 123)
            self.assertTrue(fetch.call_args.kwargs['descending'])
            self.assertEqual(fetch.call_args.kwargs['updated_since'], original_since)
            self.assertEqual(observation_freshness(self.db, self.now + timedelta(hours=2))['covered_through'], self.now)
            retire.assert_not_called()
    def test_overlap_and_failure_are_visible(self):
        previous = self.now - timedelta(days=1)
        self.db.add(SourceSync(source_name=INCREMENTAL_SOURCE, last_succeeded_at=previous, last_result=json.dumps({'covered_through': previous.isoformat(), 'status':'ok'})))
        self.db.commit()
        with patch('crawler.inaturalist.fetch_observations', side_effect=RuntimeError('upstream unavailable')) as fetch:
            with self.assertRaises(RuntimeError): run_incremental_import(self.db, client=object(), now=self.now)
            self.assertEqual(fetch.call_args.kwargs['updated_since'], previous - timedelta(hours=2))
        self.assertEqual(observation_freshness(self.db, self.now)['status'], 'stale')
        self.assertIn('upstream unavailable', self.db.get(SourceSync, INCREMENTAL_SOURCE).last_error)
    def test_freshness_expires_and_tolerates_corrupt_state(self):
        self.assertEqual(observation_freshness(self.db, self.now)['status'], 'stale')
        row=SourceSync(source_name=INCREMENTAL_SOURCE, last_result=json.dumps({'covered_through':self.now.isoformat()}))
        self.db.add(row); self.db.commit()
        self.assertEqual(observation_freshness(self.db, self.now)['status'], 'current')
        self.assertEqual(observation_freshness(self.db, self.now + timedelta(hours=27))['status'], 'stale')
        row.last_result='{"covered_through":"invalid"}'
        self.assertEqual(observation_freshness(self.db, self.now)['status'], 'stale')
    def test_descending_pagination_uses_changed_since_and_id_below(self):
        from unittest.mock import MagicMock
        client=MagicMock()
        client.get.return_value.json.side_effect=[{'results':[{'id':9},{'id':8}], 'total_results':3},{'results':[{'id':7}], 'total_results':1}]
        records, _, complete, cursor=fetch_observations(client,[48494],self.now.date(),per_page=2,descending=True,updated_since=self.now,sleeper=lambda _:None)
        self.assertEqual([p['id'] for p in records],[9,8,7]); self.assertTrue(complete); self.assertIsNone(cursor)
        params=client.get.call_args.kwargs['params']
        self.assertEqual(params['id_below'],8); self.assertEqual(params['order'],'desc'); self.assertTrue(params['updated_since'].endswith('Z'))
    def test_record_catalogue_supports_new_plants_but_not_toxic_references(self):
        self.assertEqual(len(PLANTS),44); self.assertEqual(len(RECORD_PLANTS),37)
        self.assertIn('wild-garlic', RECORD_PLANTS)
        self.assertNotIn('lily-of-the-valley', RECORD_PLANTS)
