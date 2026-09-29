CID=$(docker ps -q -f name=openvpm-postgres-cfoqxx)
docker exec -i $CID psql -U openpims -d openpims -c "SELECT id, first_name, last_name, external_id FROM clients WHERE external_source = 'cehz_farm';"
docker exec -i $CID psql -U openpims -d openpims -c "SELECT count(*) FROM patients WHERE species = 'bovine';"
docker exec -i $CID psql -U openpims -d openpims -c "SELECT count(*) FROM invoices WHERE status = 'draft' AND client_id IN (SELECT id FROM clients WHERE external_source = 'cehz_farm');"
docker exec -i $CID psql -U openpims -d openpims -c "SELECT reference_number, submission_type, status, cehz_code, ear_tag_number FROM ext_kvepis_submissions WHERE cehz_code IS NOT NULL;"

