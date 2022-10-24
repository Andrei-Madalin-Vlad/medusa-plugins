import { useSentryTransactionsFilters } from './hooks/use-sentry-transactions-filter';
import React, { useEffect, useMemo, useState } from 'react';
import qs from 'qs';
import { isEmpty } from 'lodash';
import { defaultFilterValues } from '../types';
import { usePagination, useTable } from 'react-table';
import Table from '../components/temp/molecules/table';
import InputField from '../components/temp/molecules/input';
import { TablePagination } from '../components/table-pagination';
import Tooltip from '../components/temp/atoms/tooltip';
import { SentryTableRow } from '../components/table-row';
import { ActionType } from '../components/temp/molecules/actionables';
import PublishIcon from '../components/temp/fundamentals/icons/publish-icon';
import TransactionStats from '../components/graphs';

type Props = {
	medusaClient: any;
	organisation: string;
	project: string;
	location: Location;
	onRowClick: (row) => string;
};

const useSentryTransactionsTableColumn = () => {
	const columns = useMemo(
		() => [
			{
				Header: 'Transaction',
				accessor: 'transaction',
				Cell: ({ row: { original } }) => {
					return <div className="flex items-center inter-small-semibold">{original.transaction}</div>;
				},
			},
			{
				Header: 'TPM',
				accessor: 'tpm',
				Cell: ({ row: { original } }) => {
					return (
						<Tooltip content="Throughput indicates the number of transactions over a given time range (Total), average transactions per minute (TPM),">
							<div className="flex items-center">{Number(original['tpm()']).toFixed(2)}</div>
						</Tooltip>
					);
				},
			},
			{
				Header: 'P50',
				accessor: 'p50',
				Cell: ({ row: { original } }) => {
					return (
						<Tooltip content="The P50 Threshold indicates that 50% of transaction durations are greater than the threshold">
							<div className="flex items-center">{Number(original['p50()']).toFixed(2)} ms</div>
						</Tooltip>
					);
				},
			},
			{
				Header: 'P75',
				accessor: 'p75',
				Cell: ({ row: { original } }) => {
					return (
						<Tooltip content="The P75 Threshold indicates that 25% of transaction durations are greater than the threshold">
							<div className="flex items-center">{Number(original['p75()']).toFixed(2)} ms</div>
						</Tooltip>
					);
				},
			},
			{
				Header: 'P95',
				accessor: 'p95',
				Cell: ({ row: { original } }) => {
					return (
						<Tooltip content="The P95 Threshold indicates that 5% of transaction durations are greater than the threshold">
							<div className="flex items-center">{Number(original['p95()']).toFixed(2)} ms</div>
						</Tooltip>
					);
				},
			},
			{
				Header: 'APDEX',
				accessor: 'apdex',
				Cell: ({ row: { original } }) => {
					return (
						<Tooltip content="Apdex is an industry-standard metric used to track and measure user satisfaction based on your application response times. A higher Apdex score is better than a lower one; the score can go up to 1.0, representing 100% of users having a satisfactory experience. The Apdex score provides the ratio of satisfactory, tolerable, and frustrated requests in a specific transaction or endpoint. This metric provides a standard for you to compare transaction performance, understand which ones may require additional optimization or investigation, and set targets or goals for performance">
							<div className="flex items-center">{Number(original['apdex()']).toFixed(2)}</div>
						</Tooltip>
					);
				},
			},
		],
		[]
	);

	return [columns] as const;
};

const SentryTransactions = (props: Props) => {
	const { medusaClient, organisation, project, location, onRowClick } = props;

	const { setStatsPeriod, setPerPage, setQuery, setCursor, filters, queryObject, representationObject } =
		useSentryTransactionsFilters(location.search);

	const [transactions, setTransactions] = useState([]);
	const [nextCursor, setNextCursor] = useState();
	const [prevCursor, setPrevCursor] = useState();
	const [graphData, setGraphData] = useState();
	const [isLoading, setIsLoading] = useState(false);

	const fetchTransactions = () => {
		setIsLoading(true);
		Promise.all([
			medusaClient.fetchSentryTransactionsStats(queryObject).then((data) => {
				setGraphData(data);
			}),
			medusaClient.fetchSentryTransactions(queryObject as any).then(({ data, next_cursor, prev_cursor }) => {
				setTransactions(data);
				setNextCursor(next_cursor);
				setPrevCursor(prev_cursor);
			}),
		]).finally(() => {
			setIsLoading(false);
		});
	};

	useEffect(() => {
		fetchTransactions();
	}, [filters.cursor]);

	useEffect(() => {
		refreshWithFilters();
	}, [representationObject]);

	const updateUrlFromFilter = (obj = {}) => {
		const stringifield = qs.stringify(obj);
		window.history.replaceState(`/`, '', `${`?${stringifield}`}`);
	};

	const refreshWithFilters = () => {
		const filterObj = representationObject;

		if (isEmpty(filterObj)) {
			updateUrlFromFilter({
				statsPeriod: defaultFilterValues.statsPeriod,
				perPage: defaultFilterValues.perPage,
				cursor: defaultFilterValues.cursor,
			});
		} else {
			updateUrlFromFilter(filterObj);
		}
	};

	const handleNext = async () => {
		if (nextCursor) {
			setCursor(nextCursor);
		}
	};

	const handlePrev = async () => {
		if (prevCursor) {
			setCursor(prevCursor);
		}
	};

	const [columns] = useSentryTransactionsTableColumn();

	const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } = useTable(
		{
			columns,
			data: transactions ?? [],
			manualPagination: true,
			autoResetPage: false,
		} as any,
		usePagination
	);

	const getActions = (row: { original: { transaction: string } }): ActionType[] => [
		{
			label: 'Open',
			onClick: () =>
				window.open(
					`https://sentry.io/organizations/${organisation}/performance/summary/?project=${project}&query=transaction.duration%3A%3C15m&statsPeriod=24h&transaction=${row.original.transaction}&unselectedSeries=p100%28%29`,
					'_blank'
				),
			icon: <PublishIcon size={20} />,
		},
	];

	return (
		<>
			<TransactionStats graphData={graphData} />

			<div className="p-8 rounded-rounded w-full h-full bg-white overflow-y-auto">
				<>
					<Table
						filteringOptions={
							<div className={'w-full'}>
								<div className={'flex item-center space-x-4'}>
									<InputField
										label="Period"
										placeholder="24h, 48h..."
										value={filters.statsPeriod}
										onChange={(el) => setStatsPeriod(el.target.value)}
										onBlur={() => fetchTransactions()}
									/>
									<InputField
										label="Limit"
										placeholder="10, 20..."
										value={filters.perPage}
										onChange={(el) => setPerPage(el.target.value)}
										onBlur={() => fetchTransactions()}
									/>
									<InputField
										label={'Query'}
										placeholder='!transaction:"GET /admin/sentry-transactions"'
										value={filters.query}
										onChange={(el) => setQuery(el.target.value)}
										onBlur={() => fetchTransactions()}
									/>
								</div>
							</div>
						}
						isLoading={isLoading}
						{...getTableProps()}
					>
						{
							<>
								<Table.Head>
									{headerGroups?.map((headerGroup) => (
										<Table.HeadRow {...headerGroup.getHeaderGroupProps()}>
											{headerGroup.headers.map((col) => (
												<Table.HeadCell className="min-w-[100px]" {...col.getHeaderProps()}>
													{col.render('Header')}
												</Table.HeadCell>
											))}
										</Table.HeadRow>
									))}
								</Table.Head>

								<Table.Body {...getTableBodyProps()}>
									{rows?.length > 0 &&
										rows.map((row: any) => {
											prepareRow(row);
											const linkTo = (onRowClick && onRowClick(row)) || '';
											return (
												<SentryTableRow
													row={row}
													{...row.getRowProps()}
													linkTo={linkTo}
													getActions={() => getActions(row)}
												/>
											);
										})}
								</Table.Body>
							</>
						}
					</Table>

					{!isLoading && !rows.length && <p className="flex justify-center p-4">No data to show</p>}

					<TablePagination
						nextPage={handleNext}
						prevPage={handlePrev}
						hasNext={!!nextCursor}
						hasPrev={!!prevCursor}
					/>
				</>
			</div>
		</>
	);
};

export default SentryTransactions;
