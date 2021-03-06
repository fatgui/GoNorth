(function(GoNorth) {
    "use strict";
    (function(Kirja) {
        (function(Page) {

            /// Link Dialog Page Size
            var linkDialogPageSize = 15;

            /// Kirja Id Url Prefix
            var kirjaIdUrlPrefx = "/Kirja#id=";

            /**
             * Page View Model
             * @class
             */
            Page.ViewModel = function()
            {
                this.id = new ko.observable("");
                var paramId = GoNorth.Util.getParameterFromHash("id");
                if(paramId)
                {
                    this.id(paramId);
                }

                this.isLoading = new ko.observable(false);
                this.isReadonly = new ko.observable(false);
                this.lockedByUser = new ko.observable("");

                this.isEditMode = new ko.observable(false);
                this.isDirty = new ko.observable(false);

                var self = this;
                this.pageName = new ko.observable("");
                this.pageName.subscribe(function() {
                    self.isDirty(true);
                });
                this.pageContent = new ko.observable("");
                this.pageContent.subscribe(function() {
                    self.isDirty(true);
                });

                this.showConfirmDirtyExitEdit = new ko.observable(false);

                this.showConfirmDeleteDialog = new ko.observable(false);

                this.linkDialog = new GoNorth.ChooseObjectDialog.ViewModel();
                this.linkDialogInsertHtmlCallback = null;

                this.showNewWaitPageDialog = new ko.observable(false);

                this.showSidebar = new ko.observable(false);

                this.mentionedInPages = new ko.observableArray();
                this.loadingMentionedInPages = new ko.observable(false);
                this.loadingMentionedInPagesError = new ko.observable(false);

                this.mentionedQuests = new ko.observableArray();
                this.loadingMentionedQuests = new ko.observable(false);
                this.loadingMentionedQuestsError = new ko.observable(false);

                this.mentionedNpcs = new ko.observableArray();
                this.loadingMentionedNpcs = new ko.observable(false);
                this.loadingMentionedNpcsError = new ko.observable(false);

                this.mentionedItems = new ko.observableArray();
                this.loadingMentionedItems = new ko.observable(false);
                this.loadingMentionedItemsError = new ko.observable(false);

                this.markedInMaps = new ko.observableArray();
                this.loadingMarkedInMaps = new ko.observable(false);
                this.loadingMarkedInMapsError = new ko.observable(false);

                this.errorOccured = new ko.observable(false);
                this.additionalErrorDetails = new ko.observable("");
                this.pageNotFound = new ko.observable(false);

                this.attachmentFiles = new ko.observableArray();
                this.showConfirmDeleteAttachmentDialog = new ko.observable(false);
                this.attachmentToDelete = null;

                var isNewPage = GoNorth.Util.getParameterFromHash("newPage") == "1";
                if(this.id() || !GoNorth.Util.getParameterFromHash("newPage") == "1")
                {
                    this.loadPage();
                }
                else if(isNewPage)
                {
                    this.isEditMode(true);
                    setTimeout(function() {
                        jQuery("#gn-kirjaPageName").focus();
                    }, 1);
                }

                this.attachmentUploadUrl = new ko.computed(function() {
                    return "/api/KirjaApi/UploadPageAttachment?id=" + this.id();
                }, this);
                
                GoNorth.Util.setupValidation("#gn-kirjaHeaderFields");

                this.blockPageReload = false;
                window.onhashchange = function() {
                    if(!self.blockPageReload) {
                        self.switchPage(GoNorth.Util.getParameterFromHash("id"));
                    }
                    self.blockPageReload = false;
                }
            };

            Page.ViewModel.prototype = {
                /**
                 * Resets the error state
                 */
                resetErrorState: function() {
                    this.errorOccured(false);
                    this.additionalErrorDetails("");
                    this.pageNotFound(false);
                },

                /**
                 * Switches the page to a different page
                 * 
                 * @param {string} id Id of the page to switch to
                 * @param {object} e Event
                 */
                switchPage: function(id) {
                    this.isEditMode(false);
                    this.id(id);
                    this.resetErrorState();
                    this.showSidebar(false);
                    this.loadPage();
                },

                /**
                 * Loads a page
                 */
                loadPage: function() {
                    var url = "/api/KirjaApi/Page";
                    if(this.id())
                    {
                        url += "?id=" + this.id();
                    }

                    this.isLoading(true);
                    this.resetErrorState();
                    var self = this;
                    jQuery.ajax({ 
                        url: url, 
                        type: "GET"
                    }).done(function(data) {
                        self.isLoading(false);
                        if(!data)
                        {
                            self.errorOccured(true);
                            self.pageNotFound(true);
                            return;
                        }

                        self.pageName(data.name);
                        self.pageContent(data.content);
                        if(!self.id())
                        {
                            self.setId(data.id);
                        }

                        self.loadMentionedInPages();
                        self.loadMentionedQuests(data.mentionedQuests);
                        self.loadMentionedNpcs(data.mentionedNpcs);
                        self.loadMentionedItems(data.mentionedItems);
                        self.loadMarkedInMaps();

                        self.attachmentFiles(data.attachments);

                        self.isDirty(false);
                        self.checkLock();
                    }).fail(function(xhr) {
                        self.errorOccured(true);
                        self.isLoading(false);
                    });
                },

                /**
                 * Generates the rich text buttons
                 * 
                 * @returns {object} Rich text buttons
                 */
                generateRichTextButtons: function() {
                    var self = this;

                    var allKirjaButtons = {};
                    allKirjaButtons.insertWikiLink = {
                        title: GoNorth.Kirja.Page.toolbarButtonInsertKirjaLinkTitle,
                        icon: "glyphicon-book",
                        callback: function(htmlInsert) {
                            self.linkDialogInsertHtmlCallback = htmlInsert;
                            self.linkDialog.openKirjaPageSearch(GoNorth.Kirja.Page.toolbarButtonInsertKirjaLinkTitle, function() { self.openCreatePage() }, self.id).then(function(selectedObject) {
                                self.addLinkFromLinkDialog(selectedObject, true);
                            });
                        }
                    };

                    if(GoNorth.Kirja.Page.hasAikaRights)
                    {
                        allKirjaButtons.insertQuestLink = {
                            title: GoNorth.Kirja.Page.toolbarButtonInsertAikaQuestLinkTitle,
                            icon: "glyphicon-king",
                            callback: function(htmlInsert) {
                                self.linkDialogInsertHtmlCallback = htmlInsert;
                                self.linkDialog.openQuestSearch(GoNorth.Kirja.Page.toolbarButtonInsertAikaQuestLinkTitle).then(function(selectedObject) {
                                    self.addLinkFromLinkDialog(selectedObject, false);
                                });
                            }
                        };
                    }

                    if(GoNorth.Kirja.Page.hasKortistoRights)
                    {
                        allKirjaButtons.insertNpcLink = {
                            title: GoNorth.Kirja.Page.toolbarButtonInsertKortistoNpcLinkTitle,
                            icon: "glyphicon-user",
                            callback: function(htmlInsert) {
                                self.linkDialogInsertHtmlCallback = htmlInsert;
                                self.linkDialog.openNpcSearch(GoNorth.Kirja.Page.toolbarButtonInsertKortistoNpcLinkTitle).then(function(selectedObject) {
                                    self.addLinkFromLinkDialog(selectedObject, false);
                                });
                            }
                        };
                    }

                    if(GoNorth.Kirja.Page.hasStyrRights)
                    {
                        allKirjaButtons.insertItemLink = {
                            title: GoNorth.Kirja.Page.toolbarButtonInsertStyrItemLinkTitle,
                            icon: "glyphicon-apple",
                            callback: function(htmlInsert) {
                                self.linkDialogInsertHtmlCallback = htmlInsert;
                                self.linkDialog.openItemSearch(GoNorth.Kirja.Page.toolbarButtonInsertStyrItemLinkTitle).then(function(selectedObject) {
                                    self.addLinkFromLinkDialog(selectedObject, false);
                                });
                            }
                        };
                    }

                    return allKirjaButtons;
                },

                /**
                 * Switches to edit mode
                 */
                enterEditMode: function() {
                    this.showSidebar(false);
                    this.isEditMode(true);
                    this.acquireLock();
                },

                /**
                 * Exits the edit mode
                 */
                exitEditMode: function() {
                    if(this.isDirty())
                    {
                        this.showConfirmDirtyExitEdit(true);
                    }
                    else
                    {
                        this.exitEditModeWithoutDirtyCheck()
                    }
                },

                /**
                 * Exits the edit mode without dirty check
                 */
                exitEditModeWithoutDirtyCheck: function() {
                    this.isEditMode(false);
                    this.showConfirmDirtyExitEdit(false);
                    GoNorth.LockService.releaseCurrentLock();
                },

                /**
                 * Closes the confirm dirty exit edit dialog
                 */
                closeConfirmDirtyExitEdit: function() {
                    this.showConfirmDirtyExitEdit(false);
                },


                /**
                 * Callback if a new image file was uploaded
                 * 
                 * @param {string} image Image Filename that was uploaded
                 * @returns {string} Url of the new image
                 */
                imageUploaded: function(image) {
                    return "/api/KirjaApi/KirjaImage?imageFile=" + encodeURIComponent(image);
                },

                /**
                 * Callback if a new attachment file was uploaded
                 * 
                 * @param {string} image Filename that was uploaded
                 */
                attachmentUploaded: function(file) {
                    this.attachmentFiles.push(file);
                    this.attachmentFiles.sort(function(a1, a2) {
                        return a1.originalFilename.localeCompare(a2.originalFilename);
                    });
                },

                /**
                 * Builds the url for an attachment
                 * 
                 * @param {object} attachment Attachment to build the url for
                 * @returns {string} Attachment Url
                 */
                buildAttachmentUrl: function(attachment) {
                    return "/api/KirjaApi/KirjaAttachment?pageId=" + this.id() + "&attachmentFile=" + encodeURIComponent(attachment.filename);
                },

                /**
                 * Callback if an error occured during upload
                 * 
                 * @param {string} errorMessage Error Message
                 * @param {object} xhr Xhr Object
                 */
                uploadError: function(errorMessage, xhr) {
                    this.errorOccured(true);
                    if(xhr && xhr.responseText)
                    {
                        this.additionalErrorDetails(xhr.responseText);
                    }
                    else
                    {
                        this.additionalErrorDetails(errorMessage);
                    }
                },


                /**
                 * Opens the delete confirm dialog for an attachment
                 * 
                 * @param {object} attachment Attachment to delete
                 */
                openDeleteAttachmentDialog: function(attachment) {
                    this.showConfirmDeleteAttachmentDialog(true);
                    this.attachmentToDelete = attachment;
                },

                /**
                 * Deletes the attachment for which the confirm dialog is open
                 */
                deleteAttachment: function() {
                    var attachment = this.attachmentToDelete;

                    this.isLoading(true);
                    this.resetErrorState();
                    var self = this;
                    jQuery.ajax({ 
                        url: "/api/KirjaApi/DeleteAttachment?pageId=" + this.id() + "&attachmentFile=" + encodeURIComponent(attachment.filename), 
                        headers: GoNorth.Util.generateAntiForgeryHeader(),
                        type: "DELETE",
                    }).done(function(savedPage) {
                        self.attachmentFiles.remove(attachment);
                        self.isLoading(false);
                    }).fail(function() {
                        self.isLoading(false);
                        self.errorOccured(true);
                    });

                    this.closeConfirmAttachmentDeleteDialog();
                },

                /**
                 * Closes the delete confirm dialog
                 */
                closeConfirmAttachmentDeleteDialog: function() {
                    this.showConfirmDeleteAttachmentDialog(false);
                    this.attachmentToDelete = null;
                },


                /**
                 * Saves the page
                 */
                save: function() {
                    if(!jQuery("#gn-kirjaHeaderFields").valid())
                    {
                        return;
                    }

                    // Send Data
                    var url = "/api/KirjaApi/CreatePage";
                    if(this.id())
                    {
                        url = "/api/KirjaApi/UpdatePage?id=" + this.id();
                    }

                    var request = {
                        name: this.pageName(),
                        content: this.pageContent()
                    };

                    this.isLoading(true);
                    this.resetErrorState();
                    var self = this;
                    jQuery.ajax({ 
                        url: url, 
                        headers: GoNorth.Util.generateAntiForgeryHeader(),
                        data: JSON.stringify(request), 
                        type: "POST",
                        contentType: "application/json"
                    }).done(function(savedPage) {
                        if(!self.id())
                        {
                            self.setId(savedPage.id);
                            self.acquireLock();

                            if(window.newKirjaPageSaved) {
                                window.newKirjaPageSaved(savedPage.id, self.pageName());
                                window.newKirjaPageSaved = null;
                            }
                        }
                        self.loadMentionedQuests(savedPage.mentionedQuests);
                        self.loadMentionedNpcs(savedPage.mentionedNpcs);
                        self.loadMentionedItems(savedPage.mentionedItems);
                        self.callPageRefreshGrid();
                        self.isDirty(false);
                        self.isLoading(false);
                    }).fail(function(xhr) {
                        self.isLoading(false);
                        self.errorOccured(true);
                    });
                },

                /**
                 * Loads the pages in which the current page is mentioned
                 */
                loadMentionedInPages: function() {
                    if(!this.id())
                    {
                        return;
                    }

                    this.loadingMentionedInPages(true);
                    this.loadingMentionedInPagesError(false);
                    var self = this;
                    jQuery.ajax({ 
                        url: "/api/KirjaApi/GetPagesByPage?pageId=" + this.id(), 
                        type: "GET"
                    }).done(function(pages) {
                        var loadedPages = [];
                        for(var curPage = 0; curPage < pages.length; ++curPage)
                        {
                            loadedPages.push({
                                openLink: "/Kirja#id=" + pages[curPage].id,
                                name: pages[curPage].name
                            });
                        }
                        self.mentionedInPages(loadedPages);
                        self.loadingMentionedInPages(false);
                    }).fail(function(xhr) {
                        self.mentionedInPages([]);
                        self.loadingMentionedInPages(false);
                        self.loadingMentionedInPagesError(true);
                    });
                },

                /**
                 * Loads the mentioned quests
                 * @param {string[]} questIds Quest Ids
                 */
                loadMentionedQuests: function(questIds) {
                    if(!GoNorth.Kirja.Page.hasAikaRights || !questIds)
                    {
                        return;
                    }

                    this.loadingMentionedQuests(true);
                    this.loadingMentionedQuestsError(false);
                    var self = this;
                    jQuery.ajax({ 
                        url: "/api/AikaApi/ResolveQuestNames", 
                        headers: GoNorth.Util.generateAntiForgeryHeader(),
                        data: JSON.stringify(questIds), 
                        type: "POST",
                        contentType: "application/json"
                    }).done(function(questNames) {
                        var loadedQuestNames = [];
                        for(var curQuest = 0; curQuest < questNames.length; ++curQuest)
                        {
                            loadedQuestNames.push({
                                openLink: "/Aika/Quest#id=" + questNames[curQuest].id,
                                name: questNames[curQuest].name
                            });
                        }
                        self.mentionedQuests(loadedQuestNames);
                        self.loadingMentionedQuests(false);
                    }).fail(function(xhr) {
                        self.mentionedQuests([]);
                        self.loadingMentionedQuests(false);
                        self.loadingMentionedQuestsError(true);
                    });
                },

                /**
                 * Loads the mentioned npcs
                 * @param {string[]} npcIds Npc Ids
                 */
                loadMentionedNpcs: function(npcIds) {
                    if(!GoNorth.Kirja.Page.hasKortistoRights || !npcIds)
                    {
                        return;
                    }

                    this.loadingMentionedNpcs(true);
                    this.loadingMentionedNpcsError(false);
                    var self = this;
                    jQuery.ajax({ 
                        url: "/api/KortistoApi/ResolveFlexFieldObjectNames", 
                        headers: GoNorth.Util.generateAntiForgeryHeader(),
                        data: JSON.stringify(npcIds), 
                        type: "POST",
                        contentType: "application/json"
                    }).done(function(npcNames) {
                        var loadedNpcNames = [];
                        for(var curNpc = 0; curNpc < npcNames.length; ++curNpc)
                        {
                            loadedNpcNames.push({
                                openLink: "/Kortisto/Npc#id=" + npcNames[curNpc].id,
                                name: npcNames[curNpc].name
                            });
                        }
                        self.mentionedNpcs(loadedNpcNames);
                        self.loadingMentionedNpcs(false);
                    }).fail(function(xhr) {
                        self.mentionedNpcs([]);
                        self.loadingMentionedNpcs(false);
                        self.loadingMentionedNpcsError(true);
                    });
                },

                /**
                 * Loads the mentioned items
                 * @param {string[]} itemIds Item Ids
                 */
                loadMentionedItems: function(itemIds) {
                    if(!GoNorth.Kirja.Page.hasKortistoRights || !itemIds)
                    {
                        return;
                    }

                    this.loadingMentionedItems(true);
                    this.loadingMentionedItemsError(false);
                    var self = this;
                    jQuery.ajax({ 
                        url: "/api/StyrApi/ResolveFlexFieldObjectNames", 
                        headers: GoNorth.Util.generateAntiForgeryHeader(),
                        data: JSON.stringify(itemIds), 
                        type: "POST",
                        contentType: "application/json"
                    }).done(function(itemNames) {
                        var loadedItemNames = [];
                        for(var curItem = 0; curItem < itemNames.length; ++curItem)
                        {
                            loadedItemNames.push({
                                openLink: "/Styr/Item#id=" + itemNames[curItem].id,
                                name: itemNames[curItem].name
                            });
                        }
                        self.mentionedItems(loadedItemNames);
                        self.loadingMentionedItems(false);
                    }).fail(function(xhr) {
                        self.mentionedItems([]);
                        self.loadingMentionedItems(false);
                        self.loadingMentionedItemsError(true);
                    });
                },

                /**
                 * Loads the maps in which the pages was marked
                 */
                loadMarkedInMaps: function() {
                    if(!GoNorth.Kirja.Page.hasKartaRights)
                    {
                        return;
                    }

                    this.markedInMaps([]);
                    this.loadingMarkedInMaps(true);
                    this.loadingMarkedInMapsError(false);
                    var self = this;
                    jQuery.ajax({ 
                        url: "/api/KartaApi/GetMapsByKirjaPageId?pageId=" + this.id(), 
                        type: "GET"
                    }).done(function(maps) {
                        var loadedMaps = [];
                        for(var curMap = 0; curMap < maps.length; ++curMap)
                        {
                            var url = "/Karta#id=" + maps[curMap].mapId;
                            if(maps[curMap].markerIds.length == 1)
                            {
                                url += "&zoomOnMarkerId=" + maps[curMap].markerIds[0] + "&zoomOnMarkerType=" + maps[curMap].mapMarkerType
                            }

                            loadedMaps.push({
                                openLink: url,
                                name: maps[curMap].name,
                                markerCount: maps[curMap].markerIds.length,
                                tooltip: GoNorth.Kirja.Page.kirjaMapMarkerCountTooltip.replace("{0}", maps[curMap].markerIds.length)
                            });
                        }
                        self.markedInMaps(loadedMaps);
                        self.loadingMarkedInMaps(false);
                    }).fail(function(xhr) {
                        self.loadingMarkedInMaps(false);
                        self.loadingMarkedInMapsError(true);
                    });
                },

                /**
                 * Sets the id
                 * 
                 * @param {string} id Id of the page
                 */
                setId: function(id) {
                    this.id(id);
                    this.blockPageReload = true;
                    window.location.hash = "id=" + id;
                },


                /**
                 * Opens the confirm delete dialog
                 */
                openConfirmDeleteDialog: function() {
                    this.showConfirmDeleteDialog(true);
                },

                /**
                 * Closes the confirm delete dialog
                 */
                closeConfirmDeleteDialog: function() {
                    this.showConfirmDeleteDialog(false);
                },

                /**
                 * Deletes the current page
                 */
                deletePage: function() {
                    this.closeConfirmDeleteDialog();
                    this.isLoading(true);
                    this.resetErrorState();
                    var self = this;
                    jQuery.ajax({ 
                        url: "/api/KirjaApi/DeletePage?id=" + this.id(), 
                        headers: GoNorth.Util.generateAntiForgeryHeader(),
                        type: "DELETE"
                    }).done(function(data) {
                        self.isLoading(false);
                        if(self.callPageRefreshGrid())
                        {
                            window.close();
                        }
                        else
                        {
                            window.location = "/Kirja";
                        }
                    }).fail(function(xhr) {
                        self.isLoading(false);
                        self.errorOccured(true);

                        // If npc is related to anything that prevents deleting a bad request (400) will be returned
                        if(xhr.status == 400 && xhr.responseText)
                        {
                            self.additionalErrorDetails(xhr.responseText);
                        }
                    });
                },

                /**
                 * Adds a link from the link dialog
                 * 
                 * @param {object} linkObj Link object
                 * @param {bool} samePage true if the link should open on the same page, else false
                 */
                addLinkFromLinkDialog: function(linkObj, samePage) {
                    if(samePage)
                    {
                        this.linkDialogInsertHtmlCallback("<a href='" + linkObj.openLink  + "'>" + linkObj.name + "</a>");
                    }
                    else
                    {
                        this.linkDialogInsertHtmlCallback("<a href='" + linkObj.openLink + "' target='_blank'>" + linkObj.name + "</a>");
                    }
                },

                /**
                 * Opens a page to create a new kirja page
                 */
                openCreatePage: function() {
                    this.linkDialog.closeDialog();
                    this.showNewWaitPageDialog(true);

                    var self = this;
                    var newPage = window.open("/Kirja#newPage=1");
                    newPage.onbeforeunload = function() {
                        self.showNewWaitPageDialog(false);
                    };
                    newPage.newKirjaPageSaved = function(id, name) {
                        self.addLinkFromLinkDialog({ name: name, openLink: kirjaIdUrlPrefx + id, id }, true);
                        self.showNewWaitPageDialog(false);
                        self.save();
                    };
                },

                /**
                 * Toogles the sidebar
                 */
                toogleSidebar: function() {
                    this.showSidebar(!this.showSidebar());
                },


                /**
                 * Checks the lock without locking it
                 */
                checkLock: function() {
                    var self = this;
                    GoNorth.LockService.checkLock("KirjaPage", this.id()).done(function(isLocked, lockedUsername) { 
                        self.handleLockResult(isLocked, lockedUsername);
                    }).fail(function() {
                        self.errorOccured(true);
                        self.exitEditModeWithoutDirtyCheck();
                    });
                },

                /**
                 * Acquires a lock
                 */
                acquireLock: function() {
                    var self = this;
                    GoNorth.LockService.acquireLock("KirjaPage", this.id()).done(function(isLocked, lockedUsername) { 
                        self.handleLockResult(isLocked, lockedUsername);
                    }).fail(function() {
                        self.errorOccured(true);
                        self.exitEditModeWithoutDirtyCheck();
                    });
                },

                /**
                 * Handles the lock result
                 * 
                 * @param {bool} isLocked true if the resource is locked, else false
                 * @param {string} lockedUsername Name of the user who owns the lock at the moment
                 */
                handleLockResult: function(isLocked, lockedUsername) {
                    if(isLocked)
                    {
                        this.isReadonly(true);
                        this.lockedByUser(lockedUsername);
                        this.exitEditModeWithoutDirtyCheck();
                    }
                    else
                    {
                        this.isReadonly(false);
                        this.lockedByUser("");
                    }
                },


                /**
                 * Calls the npc refresh for the grid of the parent window
                 * 
                 * @returns {bool} true if a refresh was triggered, else false 
                 */
                callPageRefreshGrid: function() {
                    if(window.refreshKirjaPageGrid)
                    {
                        window.refreshKirjaPageGrid();
                        return true;
                    }

                    return false;
                }
            };

        }(Kirja.Page = Kirja.Page || {}));
    }(GoNorth.Kirja = GoNorth.Kirja || {}));
}(window.GoNorth = window.GoNorth || {}));