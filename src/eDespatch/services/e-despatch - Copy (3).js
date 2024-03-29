// var SinifGrubu = require('./uyumsoft/DespatchIntegration.class.js')
let downloadInterval = config.downloadInterval || 5000

let serviceName = `eDespatch`
let defaultServiceName = `eDespatch`
let ioBox = (ioType) => { return ioType == 0 ? 'Outbox' : 'Inbox' }
var soap = require('soap')
//global.WcfHelper = require(path.join(__root, 'lib/wcf-helper')).WcfHelper

exports.getDespatch = (dbModel, ioType, client, integrator, listItem, callback) => {
	let logPrefix = `${dbModel.nameLog} ${defaultServiceName.green + '/GetDespatch'.cyan + '/' + ioBox(ioType)},`
	dbModel.despatches.findOne({ ioType: ioType, eIntegrator: listItem.docId2, 'uuid.value': listItem.docId }, (err, doc) => {
		if(dberr(err, callback)) {
			if(doc == null) {
				let resField = ''
				let GetDespatch = (query, cb) => {
					if(ioType == 0) {
						resField = 'GetOutboxDespatchResult'
						client.GetOutboxDespatch(query, cb)

					} else {
						resField = 'GetInboxDespatchResult'
						client.GetInboxDespatch(query, cb)
					}
				}
				GetDespatch({ despatchId: listItem.docId }, (err, resp, rawResponse, soapHeader, rawRequest) => {
					tempLog(`getDespatch_${ioBox(ioType)}_rawRequest_${listItem.docId}.xml`, rawRequest)
					tempLog(`getDespatch_${ioBox(ioType)}_rawResponse_${listItem.docId}.xml`, rawResponse)
					tempLog(`getDespatch_${ioBox(ioType)}_soapHeader_${listItem.docId}.json`, JSON.stringify(soapHeader, null, 2))
					tempLog(`getDespatch_${ioBox(ioType)}_resp_${listItem.docId}.json`, JSON.stringify(resp || {}, null, 2))
					if(dberr(err, callback)) {
						let data = resp[resField]
						data = convertSoapObject(data, (d) => despatchAdvice.toISOString().substr(0, 10))
						data = convertAttrNumber(data)
						if(data.attr.isSucceded == 'false') return cb({ code: 'getDespatch', message: data.attr.message })

						let obj = convertSoapObject(data.value.despatchAdvice, (d) => d.toISOString().substr(0, 10))
						let newDoc = new dbModel.despatches(obj)
						newDoc.eIntegrator = integrator._id
						newDoc.ioType = ioType
						newDoc.despatchStatus = listItem.document.statusEnum
						if(newDoc.profileId.value == 'TEMELSEVKIRSALIYESI') {
							newDoc.profileId.value = 'TEMELIRSALIYE'
						}


						newDoc.save((err, newDoc2) => {
							if(!err) {
								eventLog(`${logPrefix} ${newDoc2.ID.value} indirildi`)
							}
							listItem.status = 'Downloaded'
							listItem.save((err) => {
								if(callback)
									callback(err)
							})

						})
					}
				})
			} else {
				eventLog(`${logPrefix} ${doc.ID.value} zaten var`)
				if(ioType == 0) {
					listItem.status = 'Uploaded'
				} else {
					listItem.status = 'Downloaded'
				}

				listItem.save((err) => {
					if(callback)
						callback(err)
				})
			}
		}
	})
}

function syncDespatches(dbModel, ioType, integrator, srvcName, callback) {
	let logPrefix = `${dbModel.nameLog} ${srvcName.green}, sync`
	let limit = 0
	if(config.status != 'release') {
		limit = 3
	}
	eventLog(`${logPrefix} started `)
	createClient(integrator, (err, client) => {
		if(!err) {
			dbModel.temp_table.find({ docType: `eDespatch_sync${ioBox(ioType)}List`, status: '', docId2: integrator._id }).limit(limit).exec((err, docs) => {
				if(dberr(err, callback)) {
					iteration(docs, (listItem, cb) => { exports.getDespatch(dbModel, ioType, client, integrator, listItem, cb) }, downloadInterval, true, (err, result) => {
						if(err)
							errorLog(`${logPrefix} error:`, err)
						else
							eventLog(`${logPrefix} OK`)

						if(callback) callback(err, result)
					})
				}
			})
		} else {
			errorLog(`${logPrefix} error:`, err)
			if(callback) callback(err)
		}
	})
}


function convertAttrNumber(data) {
	if(data.value == undefined) return data
	if(data.value.attr == undefined) return data

	if(data.value.attr.pageIndex != undefined) data.value.attr.pageIndex = Number(data.value.attr.pageIndex)
	if(data.value.attr.totalPages != undefined) data.value.attr.totalPages = Number(data.value.attr.totalPages)
	if(data.value.attr.pageSize != undefined) data.value.attr.pageSize = Number(data.value.attr.pageSize)
	if(data.value.attr.totalCount != undefined) data.value.attr.totalCount = Number(data.value.attr.totalCount)

	return data
}

function syncDespatchList(dbModel, ioType, integrator, srvcName, callback) {
	let logPrefix = `${dbModel.nameLog} ${srvcName.green}, syncList`
	createClient(integrator, (err, client) => {
		if(!err) {
			syncDespatchList_queryModel(dbModel, ioType, integrator, (err, query) => {
				let resField = ''
				let GetDespatchList = (query, cb) => {
					if(ioType == 0) {
						client.GetOutboxDespatchList(query, cb)
						resField = 'GetOutboxDespatchListResult'
					} else {
						client.GetInboxDespatchList(query, cb)
						resField = 'GetInboxDespatchListResult'
					}
				}

				console.log(`syncDespatchList query:`, query)

				function indir(cb) {
					GetDespatchList({ query: query }, (err, resp, rawResponse, soapHeader, rawRequest) => {
						tempLog(`syncDespatchList_${ioBox(ioType)}_rawRequest_${(new Date()).yyyymmdd()}.xml`, rawRequest)
						tempLog(`syncDespatchList_${ioBox(ioType)}_rawResponse_${(new Date()).yyyymmdd()}.xml`, rawResponse)
						tempLog(`syncDespatchList_${ioBox(ioType)}_soapHeader_${(new Date()).yyyymmdd()}.json`, JSON.stringify(soapHeader, null, 2))
						tempLog(`syncDespatchList_${ioBox(ioType)}_resp_${(new Date()).yyyymmdd()}.json`, JSON.stringify(resp || {}, null, 2))

						if(dberr(err, cb)) {
							let data = resp[resField]
							console.log(`data1:`, data)
							data = convertSoapObject(data)
							console.log(`data2:`, data)
							data = convertAttrNumber(data)
							console.log(`data3:`, data)
							if(data.attr.isSucceded == 'false') return cb({ code: 'syncDespatchList', message: data.attr.message })
							if(data.value.attr.totalPages == 0) return cb(null)
							eventLog(`${logPrefix} page:${data.value.attr.pageIndex+1}/${data.value.attr.totalPages}`)
							if(!Array.isArray(data.value.items)) {
								data.value.items = [clone(data.value.items)]
							}
							data.value.items.forEach((e) => { e._integratorId = integrator._id })
							iteration(data.value.items, (item, cb) => { insertTempTable(dbModel, ioType, item, cb) }, 0, false, (err) => {
								if(dberr(err, cb)) {
									if(config.status != 'release') {
										if(data.value.attr.pageIndex < data.value.attr.totalPages - 1 && data.value.attr.pageIndex < 2) {
											query.attr.PageIndex++
											setTimeout(indir, downloadInterval, cb)
										} else {
											cb(null)
										}
									} else {
										if(data.value.attr.pageIndex < data.value.attr.totalPages - 1) {
											query.attr.PageIndex++
											setTimeout(indir, downloadInterval, cb)
										} else {
											cb(null)
										}
									}
								}
							})
						}
					})
				}

				indir((err) => {
					if(callback)
						callback(err)
				})
			})
		} else {
			callback(err)
		}
	})
}


function syncDespatchList_queryModel(dbModel, ioType, integrator, cb) {
	let query = {
		attr: {
			PageIndex: 0,
			PageSize: 10,
			SetTaken: false,
			OnlyNewestDespatches: false
		},
		CreateStartDate: defaultStartDate(),
		CreateEndDate: endDate()
	}


	dbModel.temp_table.find({ docType: `eDespatch_sync${ioBox(ioType)}List` }).sort({ orderBy: -1 }).limit(1).exec((err, docs) => {
		if(!err) {
			if(docs.length > 0) {
				let tarih = new Date(docs[0].document['createDateUtc'])
				tarih.setMinutes(tarih.getMinutes() + (new Date()).getTimezoneOffset() * -1)
				query.CreateStartDate = tarih.toISOString()

				cb(null, query)
			} else {
				cb(null, query)
			}
		} else {
			cb(err, query)
		}
	})
}


function downloadDespatches(dbModel, ioType, srvcName, callback) {
	let logPrefix = `${dbModel.nameLog} ${srvcName.green}`
	dbModel.integrators.find({ passive: false }, (err, docs) => {
		if(dberr(err, callback)) {
			let integrators = []
			docs.forEach((e) => {
				if(e.despatch.url != '' && e.despatch.username != '' && e.despatch.password != '') {
					let itg = e.toJSON()
					//itg['despatchIntegration'] = new SinifGrubu.DespatchIntegration(itg.despatch.url, itg.despatch.username, itg.despatch.password)
					integrators.push(itg)
				}
			})

			iteration(integrators, (integrator, cb) => {
				syncDespatchList(dbModel, ioType, integrator, srvcName, (err) => {
					if(!err) {
						syncDespatches(dbModel, ioType, integrator, srvcName, cb)
					} else {
						cb(err)
					}
				})
			}, 0, false, (err, result) => {
				if(err) {
					errorLog(`${logPrefix}, syncList error:`, err)
				} else {
					eventLog(`${logPrefix}, syncList OK`)
				}
				if(callback) callback()
			})
		}
	})
}


function insertTempTable(dbModel, ioType, item, callback) {
	if(item['statusEnum'] == 'Error')
		return callback(null)
	let filter = {
		docType: `eDespatch_sync${ioBox(ioType)}List`,
		docId: item['despatchId'],
		docId2: item['_integratorId']
	}

	dbModel.temp_table.findOne(filter, (err, doc) => {
		if(err)
			return callback(err)
		if(doc == null) {
			let data = {
				docType: `eDespatch_sync${ioBox(ioType)}List`,
				docId: item['despatchId'],
				docId2: item['_integratorId'],
				document: item,
				status: '',
				orderBy: item['createDateUtc']
			}

			doc = new dbModel.temp_table(data)
			doc.save((err) => {
				callback(err)
			})
		} else {
			if(doc.document['statusEnum'] != item['statusEnum']) {
				doc.status = 'modified'
				doc.document = item
				doc.modifiedDate = new Date()

				doc.save((err) => {
					callback(err)
				})
			} else {
				callback(null)
			}
		}
	})
}


exports.xsltView = (dbModel, despatchDoc, callback) => {
	try {
		createClient(despatchDoc.eIntegrator, (err, client) => {
			if(!err) {
				let resField = ''
				let GetDespatchView = (despatchId, cb) => {
					if(despatchDoc.ioType == 0) {
						resField = 'GetOutboxDespatchViewResult'
						client.GetOutboxDespatchView(despatchId, cb)
					} else {
						resField = 'GetInboxDespatchViewResult'
						client.GetInboxDespatchView(despatchId, cb)
					}
				}


				GetDespatchView({ despatchId: despatchDoc.uuid.value }, (err, resp) => {
					if(!err) {
						let data = resp[resField]
						data = convertSoapObject(data)
						if(data.attr.isSucceded == 'false') return callback({ code: 'xsltView', message: data.attr.message })
						callback(null, data.value.html)
					} else {
						callback(err)
					}
				})
			} else {
				callback(err)
			}
		})
	} catch (tryErr) {
		console.error('try Error:', tryErr)
		callback(tryErr)
	}
}


function despatchTime(text) {
	let sbuf = '09:13:11.0000000+03:00'
	return sbuf
}

exports.getXslt = (dbModel, despatchDoc, cb) => {
	if(despatchDoc.eIntegrator.despatch.xslt) {
		dbModel.files.findOne({ _id: despatchDoc.eIntegrator.despatch.xslt }, (err, doc) => {
			if(!err) {
				if(doc != null) {
					if(doc.data.indexOf('base64,') > -1) {
						cb(null, doc.data.split('base64,')[1])
					} else {
						cb(null, doc.data)
					}

				} else {
					cb(null)
				}
			} else {
				cb(err)
			}
		})
	} else {
		cb(null)
	}
}



function queryDespatchStatus(dbModel, despatchDoc, cb) {
	try {
		if(!despatchDoc.eIntegrator)
			return cb(null)
		dbModel.despatches.findOne({ _id: despatchDoc._id }, (err, irsaliyeDoc) => {
			if(dberr(err, cb)) {
				if(dbnull(irsaliyeDoc, cb)) {

					if(config.status != 'release') {
						despatchDoc.eIntegrator.party.partyIdentification[0].ID.value = '9000068418'
						despatchDoc.eIntegrator.despatch.url = 'https://efatura-test.uyumsoft.com.tr/Services/DespatchIntegration?wsdl'
						despatchDoc.eIntegrator.despatch.username = 'Uyumsoft'
						despatchDoc.eIntegrator.despatch.password = 'Uyumsoft'
					}
					createClient(despatchDoc.eIntegrator, (err, client) => {
						if(dberr(err, cb)) {
							let resField = ''
							let QueryDespatchStatus = (despatchIds, cb) => {
								if(despatchDoc.ioType == 0) {
									resField = 'GetOutboxDespatchStatusWithLogsResult'
									client.GetOutboxDespatchStatusWithLogs(despatchIds, cb)
									// client.QueryOutboxDespatchStatus(despatchIds, cb)
								} else {
									resField = 'GetInboxDespatchStatusWithLogsResult'
									client.GetInboxDespatchStatusWithLogs(despatchIds, cb)
								}
							}
							let GetDespatchList = (query, cb) => {
								if(despatchDoc.ioType == 0) {
									return client.QueryOutboxDespatchStatus(query, cb)
								} else {
									return client.QueryInboxDespatchStatus(query, cb)
								}
							}

							let query = {
								attr: {
									PageIndex: 0,
									PageSize: 10
								},
								DespatchIds: [despatchDoc.uuid.value]
							}
							GetDespatchList(query, (err, data) => {
								if(dberr(err, cb)) {
									data = convertSoapObject(data)
									data = convertAttrNumber(data)

									if(!data.value) return cb(null)
									if(!data.value.items) return cb(null)

									if(!Array.isArray(data.value.items))
										data.value.items = [clone(data.value.items)]

									let obj = {
										_id: despatchDoc._id,
										uuid: data.value.items[0].despatchId,
										ID: data.value.items[0].despatchNumber,
										title: data.value.items[0].targetTitle,
										vknTckn: data.value.items[0].targetTcknVkn,
										despatchStatus: data.value.items[0].statusEnum
									}
									tempLog(`${despatchDoc.ID.value}_queryDespatchStatus.json`, JSON.stringify(data, null, 2))
									if(despatchDoc.despatchStatus != data.value.items[0].statusEnum) {

										irsaliyeDoc.despatchStatus = data.value.items[0].statusEnum

										if(irsaliyeDoc.despatchStatus != 'Error') {
											irsaliyeDoc.despatchErrors = []
										}

										irsaliyeDoc.save(() => {
											cb(null, obj)
										})
									} else {
										cb(null, obj)
									}
								}
							})
						}
					})
				}
			}
		})
	} catch (e) {
		cb(e)
	}
}

function checkDespatcheStatus(dbModel, srvcName, callback) {
	let logPrefix = `${dbModel.nameLog} ${srvcName.green}`
	let baslamaTarihi = (new Date()).addDays(-15).yyyymmdd()

	let options = {
		page: 1,
		limit: 50,
		populate: [
			{ path: 'eIntegrator', select: '_id eIntegrator despatch party' }
		],

		select: '_id ioType eIntegrator ID uuid issueDate issueTime despatchStatus',
		sort: { 'issueDate.value': -1, 'ID.value': -1 }
	}

	if(config.status != 'release') {
		baslamaTarihi = (new Date()).addDays(-180).yyyymmdd()
		options.sort = { 'issueDate.value': -1, 'ID.value': -1 }
	}

	let filter = {
		ioType: 0,
		despatchStatus: { $nin: ['Approved', 'PartialApproved', 'Declined', 'Canceled', 'Cancelled'] },
		'issueDate.value': { $gte: baslamaTarihi }
	}

	console.log(`filter:`, filter)

	dbModel.despatches.paginate(filter, options, (err, resp) => {
		if(dberr(err, callback)) {


			eventLog(`${logPrefix}, count:${resp.docs.length}`)
			tempLog(`checkDespatcheStatus.dbModel.despatches.paginate.json`, JSON.stringify(resp.docs, null, 2))

			let index = 0

			function calistir(cb) {
				if(index >= resp.docs.length)
					return cb()
				if(config.status != 'release' && index >= 5)
					return cb()

				queryDespatchStatus(dbModel, resp.docs[index], (err, result) => {
					if(err) {
						errorLog(`${logPrefix}, checking:${(index+1)}/${resp.docs.length} ${resp.docs[index].ID.value}  error:`, err)
					} else {
						eventLog(`${logPrefix}, checking:${(index+1)}/${resp.docs.length}`)
					}
					index++
					setTimeout(calistir, 10, cb)
				})
			}

			calistir(() => {
				if(callback) callback(err)
			})
		}
	})
}

function task_sentToGib(dbModel, srvcName, callback) {
	let logPrefix = `${dbModel.nameLog} ${srvcName.green}`
	dbModel.despatches.find({ localStatus: 'pending' }).populate('eIntegrator').exec((err, docs) => {

		if(dberr(err, callback)) {
			if(docs.length > 0) {
				eventLog(`${dbModel.nameLog} ${serviceName.cyan}, task count:${docs.length}`)
				iteration(docs, (despatchDoc, cb) => {
					despatchDoc.localStatus = 'transferring'
					despatchDoc.localErrors = []
					despatchDoc.save()
					sendDespatchToGib(dbModel, despatchDoc, (err) => {
						if(!err) {
							despatchDoc.localStatus = 'transferred'
							despatchDoc.localErrors = []
						} else {
							despatchDoc.localStatus = 'error'
							despatchDoc.localErrors.push({ code: (err.code || err.name || 'TASK_ERROR'), message: err.message })
						}
						despatchDoc.save(cb)
					})
				}, 0, true, (err, result) => {
					if(callback) {
						callback(err)
					}
				})
			} else {
				if(callback) {
					callback()
				}
			}
		}
	})
}

function defaultStartDate() {
	return (new Date((new Date()).getFullYear(), 11, 1, 0, 0, 0)).toISOString()
}

function endDate() {
	let a = new Date()
	a.setMinutes(a.getMinutes() + (new Date()).getTimezoneOffset() * -1)
	return a.toISOString()
}


var despatchHelper = require('./despatch-hepler.js')

function sendDespatchToGib(dbModel, despatchDoc, cb) {
	try {

		exports.getXslt(dbModel, despatchDoc, (err, xsltData) => {
			if(dberr(err, cb)) {
				if(config.status != 'release') {
					despatchDoc.eIntegrator.party.partyIdentification[0].ID.value = '9000068418'
					despatchDoc.eIntegrator.despatch.url = 'https://efatura-test.uyumsoft.com.tr/Services/DespatchIntegration'
					despatchDoc.eIntegrator.despatch.username = 'Uyumsoft'
					despatchDoc.eIntegrator.despatch.password = 'Uyumsoft'
				}

				createClient(despatchDoc.eIntegrator, (err, client) => {
					if(dberr(err, cb)) {
						let despatchInfo = despatchHelper.gonderilecekIrsaliyeAlanlariniDuzenle(despatchDoc.toJSON(), xsltData)


						client.SendDespatch({ despatches: [{ DespatchInfo: despatchInfo }] }, (err, resp, rawResponse, soapHeader, rawRequest) => {

							if(!err) {
								tempLog(`sendDespatchToGib_rawRequest_${despatchDoc.ID.value}.xml`, rawRequest)
								tempLog(`sendDespatchToGib_rawResponse_${despatchDoc.ID.value}.xml`, rawResponse)
								tempLog(`sendDespatchToGib_soapHeader_${despatchDoc.ID.value}.json`, JSON.stringify(soapHeader, null, 2))
								tempLog(`sendDespatchToGib_resp_${despatchDoc.ID.value}.json`, JSON.stringify(resp || {}, null, 2))

								let data = convertSoapObject(resp.SendDespatchResult)

								console.log(`data:`, data)
								if(data.attr.isSucceded == 'false') {
									return cb({ code: 'sendToGib', message: `db:${dbModel.dbName} ${data.attr.message}` })
								}
								console.log(`data.value:`, data.value)
								despatchDoc.despatchStatus = 'Queued'
								despatchDoc.localStatus = 'transferred'
								despatchDoc.localErrors = []
								despatchDoc.uuid = { value: data.value[0].attr.id }
								despatchDoc.ID = { value: data.value[0].attr.number }
								despatchDoc.save((err) => {
									if(!err) {
										cb(null, data.value)
									} else {
										cb(err)
									}
								})

							} else {
								tempLog(`sendDespatchToGib_response_err_${despatchDoc.ID.value}.xml`, err.response.config.data)
								errorLog(`${serviceName}  sendToGib Hata ${despatchDoc.ID.value}:`, err)
								despatchDoc.despatchStatus = 'Error'
								despatchDoc.localStatus = 'transferred'
								despatchDoc.localErrors = []
								despatchDoc.despatchErrors.push({ code: (err.code || err.name), message: (err.message || err.name || 'HATA olustu') })
								despatchDoc.save(() => {
									cb(err)
								})
							}
						})
					}
				})
			}
		})

	} catch (e) {
		cb(e)
	}

}



exports.logs = (dbModel, despatchDoc, callback) => {
	if(config.status != 'release') {
		despatchDoc.eIntegrator.party.partyIdentification[0].ID.value = '9000068418'
		despatchDoc.eIntegrator.despatch.url = 'https://efatura-test.uyumsoft.com.tr/Services/DespatchIntegration'
		despatchDoc.eIntegrator.despatch.username = 'Uyumsoft'
		despatchDoc.eIntegrator.despatch.password = 'Uyumsoft'
	}
	createClient(despatchDoc.eIntegrator, (err, client) => {
		if(!err) {
			let resField = ''
			let GetDespatchStatusWithLogs = (despatchIds, cb) => {
				if(despatchDoc.ioType == 0) {
					resField = 'GetOutboxDespatchStatusWithLogsResult'
					client.GetOutboxDespatchStatusWithLogs(despatchIds, cb)
					// client.QueryOutboxDespatchStatus(despatchIds, cb)
				} else {
					resField = 'GetInboxDespatchStatusWithLogsResult'
					client.GetInboxDespatchStatusWithLogs(despatchIds, cb)
				}
			}

			console.log(`despatchDoc.uuid.value:`, despatchDoc.uuid.value)

			// GetDespatchStatusWithLogs({ despatchIds: {despatchId:despatchDoc.uuid.value.toString()} }, (err, resp, rawResponse, soapHeader, rawRequest) => {
			
			GetDespatchStatusWithLogs({despatchIds: [{'string':despatchDoc.uuid.value}]}, (err, resp, rawResponse, soapHeader, rawRequest) => {
				if(!err) {
					tempLog(`logs_rawRequest_${despatchDoc.ID.value}.xml`, rawRequest)
					tempLog(`logs_rawResponse_${despatchDoc.ID.value}.xml`, rawResponse)
					tempLog(`logs_soapHeader_${despatchDoc.ID.value}.json`, JSON.stringify(soapHeader, null, 2))
					tempLog(`logs_resp_${despatchDoc.ID.value}.json`, JSON.stringify(resp || {}, null, 2))

					let data = convertSoapObject(resp[resField])

					console.log(`logs data:`, data)
					if(data.attr.isSucceded == 'false') return callback({ code: 'logs', message: data.attr.message })

					callback(null, data.value[0])
				} else {
					tempLog(`logs_response_err_${despatchDoc.ID.value}.xml`, err.response.config.data)
					errorLog(`${serviceName}  logs Hata ${despatchDoc.ID.value}:`, err)
					callback(err)
				}

			})
		} else {
			callback(err)
		}
	})
}


function createClient(integrator, cb) {
	let wsdlOptions = {
		envelopeKey: 's',
		valueKey: 'value',
		attributesKey: 'attr',
		useEmptyTag: true,
		// overrideRootElement: {
		// 	namespace: 'xmlns:tns',
		// 	xmlnsAttributes: [{
		// 		name: 'xmlns:ns2',
		// 		value: "http://tempuri.org/"
		// 	}, {
		// 		name: 'xmlns:ns3',
		// 		value: "http://sillypets.com/xsd"
		// 	}]
		// }
	}

	let url = integrator.despatch.url
	url += (url.substr(-5) != '?wsdl' ? '?wsdl' : '')

	soap.createClient(url, wsdlOptions, (err, client) => {
		if(!err) {
			let wsSecurity = new soap.WSSecurity(integrator.despatch.username, integrator.despatch.password, { hasNonce: false })
			client.setSecurity(wsSecurity)
			client.addHttpHeader('SoftwareDefinitionId', 'c8b4601a-b65d-483f-9885-7d7aaef59460');
			cb(null, client)
		} else {

			cb(err)
		}
	})
}


function convertSoapObject(obj, dateConvertor) {
	let obj2 = util.renameObjectProperty(obj, propertyNameChanger)
	console.log(`obj2:`, obj2)

	let obj3 = addValueField('', obj2, 'attr', 'value')


	return obj3

	function addValueField(parentKey, obj, attributesKey, valueKey) {
		if(obj == null)
			return obj
		if(parentKey == attributesKey || parentKey == valueKey) {
			return obj
		}

		if(Array.isArray(obj)) {
			var newObj = []
			for(var i = 0; i < obj.length; i++) {
				newObj.push(addValueField('', obj[i], attributesKey, valueKey))
			}
			return newObj
		} else if(typeof obj === 'object') {
			if((obj instanceof Date)) {
				let obj2 = {}
				if(dateConvertor == undefined) {
					obj2[valueKey] = obj.toISOString().substr(0, 10)
				} else {
					obj2[valueKey] = dateConvertor(obj)
				}
				return obj2
			} else {
				var newObj = {}
				Object.keys(obj).forEach((key) => {
					newObj[key] = addValueField(key, obj[key], attributesKey, valueKey)
				})
				return newObj

			}
		} else if(typeof obj === 'function') {
			return obj
		} else {
			let obj2 = {}
			obj2[valueKey] = obj
			return obj2
		}
	}

	function propertyNameChanger(key, obj) {
		if(key.startsWith('UBL'))
			return key
		switch (key) {
			case 'UUID':
				return 'uuid'
			case 'ID':
				return 'ID'
			case 'URI':
				return 'URI'
			case '$':
				return 'attr'
			case 'attr':
				return 'attr'
			case 'schemeID':
				return 'schemeID'
			case 'value':
			case 'Value':
				return 'value'
		}

		key = key.substr(0, 1).toLowerCase() + key.substr(1)
		if(key.substr(-2) == 'ID' && key.length > 2) {
			key = key.substr(0, key.length - 2) + 'Id'
		}
		return key
	}
}


exports.start = () => {

	// runServiceOnAllUserDb({
	// 	filter:{'services.eIntegration.eDespatch':true},
	// 	serviceFunc:(dbModel,cb)=>{ downloadDespatches(dbModel,0,`eDespatch/${'download'.cyan}/outbox`,cb) },
	// 	name:'eDespatch/download/outbox',
	// 	repeatInterval:10000 //config.repeatInterval || 60000
	// })

	// runServiceOnAllUserDb({
	// 	filter: { 'services.eIntegration.eDespatch': true },
	// 	serviceFunc: (dbModel, cb) => { downloadDespatches(dbModel, 1, `eDespatch/${'download'.zebra}/inbox`, cb) },
	// 	name: 'eDespatch/download/inbox',
	// 	repeatInterval: 3000 //config.repeatInterval || 60000
	// })

	// runServiceOnAllUserDb({
	// 	filter:{'services.eIntegration.eDespatch':true},
	// 	serviceFunc:(dbModel,cb)=>{ checkDespatcheStatus(dbModel,`eDespatch/${'checkStatus'.cyan}`,cb) },
	// 	name:'eDespatch/checkStatus',
	// 	repeatInterval:3000 //config.repeatInterval || 60000
	// })


	// runServiceOnAllUserDb({
	// 	filter: { 'services.eIntegration.eDespatch': true },
	// 	serviceFunc: (dbModel, cb) => {
	// 		task_sentToGib(dbModel, `eDespatch/${'task'.cyan}/sentToGib`, cb)
	// 	},
	// 	name: 'eDespatch/task/sentToGib',
	// 	repeatInterval: 3000 //config.repeatInterval || 60000
	// })

	// runServiceOnAllUserDb({
	// 	filter:{'services.eIntegration.eDespatch':true},
	// 	serviceFunc:(dbModel,cb)=>{
	// 		taskListener.sendReceiptAdvice(dbModel,`${serviceName}/sendReceiptAdvice`,cb)
	// 	},
	// 	name:'eDespatch/task/sendReceiptAdvice',
	// 	repeatInterval:config.repeatInterval || 60000
	// })



}