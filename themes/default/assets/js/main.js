var tsd;
(function (tsd) {
    var $html = $('html');

    var FilterOption = (function () {
        function FilterOption(key, value) {
            var _this = this;
            this.$checkbox = $('#tsd-filter-' + key);
            this.key = key;
            this.value = value;
            this.defaultValue = value;

            if (window.localStorage[key] && window.localStorage[key] != value) {
                this.value = (window.localStorage[key] == 'true');
                this.$checkbox.prop('checked', this.value);

                $html.toggleClass('toggle-' + this.key, this.value != this.defaultValue);
            }

            this.$checkbox.on('change', function () {
                return _this.onCheckboxChanged();
            });
        }
        FilterOption.prototype.onCheckboxChanged = function () {
            this.value = this.$checkbox.prop('checked');
            window.localStorage[this.key] = (this.value ? 'true' : 'false');

            $html.toggleClass('toggle-' + this.key, this.value != this.defaultValue);
        };
        return FilterOption;
    })();

    var Filter = (function () {
        function Filter() {
            this.optionInherited = new FilterOption('inherited', true);
            this.optionPrivate = new FilterOption('private', true);
            this.optionExternals = new FilterOption('externals', true);
            this.optionOnlyExported = new FilterOption('only-exported', false);
        }
        Filter.isSupported = function () {
            try  {
                return typeof window.localStorage != 'undefined';
            } catch (e) {
                return false;
            }
        };
        return Filter;
    })();

    if (Filter.isSupported()) {
        new Filter();
    } else {
        $html.addClass('no-filter');
    }
})(tsd || (tsd = {}));
var tsd;
(function (tsd) {
    (function (search) {
        var SearchLoadingState;
        (function (SearchLoadingState) {
            SearchLoadingState[SearchLoadingState["Idle"] = 0] = "Idle";
            SearchLoadingState[SearchLoadingState["Loading"] = 1] = "Loading";
            SearchLoadingState[SearchLoadingState["Ready"] = 2] = "Ready";
            SearchLoadingState[SearchLoadingState["Failure"] = 3] = "Failure";
        })(SearchLoadingState || (SearchLoadingState = {}));

        var $el = $('#tsd-search');

        var $field = $('#tsd-search-field');

        var $results = $('.results');

        var base = $el.attr('data-base') + '/';

        var query = '';

        var loadingState = 0 /* Idle */;

        var hasFocus = false;

        var preventPress = false;

        var index;

        function createIndex() {
            index = new lunr.Index();
            index.pipeline.add(lunr.trimmer);

            index.field('name', { boost: 10 });
            index.field('parent');
            index.ref('id');

            var rows = search.data.rows;
            var pos = 0;
            var length = rows.length;
            function batch() {
                var cycles = 0;
                while (cycles++ < 100) {
                    index.add(rows[pos]);
                    if (++pos == length) {
                        return setLoadingState(2 /* Ready */);
                    }
                }
                setTimeout(batch, 10);
            }

            batch();
        }

        function loadIndex() {
            if (loadingState != 0 /* Idle */)
                return;
            setTimeout(function () {
                if (loadingState == 0 /* Idle */) {
                    setLoadingState(1 /* Loading */);
                }
            }, 500);

            if (typeof search.data != 'undefined') {
                createIndex();
            } else {
                $.get($el.attr('data-index')).done(function (source) {
                    eval(source);
                    createIndex();
                }).fail(function () {
                    setLoadingState(3 /* Failure */);
                });
            }
        }

        function updateResults() {
            if (loadingState != 2 /* Ready */)
                return;
            $results.empty();

            var res = index.search(query);
            for (var i = 0, c = Math.min(10, res.length); i < c; i++) {
                var row = search.data.rows[res[i].ref];
                var name = row.name;
                if (row.parent)
                    name = '<span class="parent">' + row.parent + '.</span>' + name;
                $results.append('<li class="' + row.classes + '"><a href="' + base + row.url + '" class="tsd-kind-icon">' + name + '</li>');
            }
        }

        function setLoadingState(value) {
            if (loadingState == value)
                return;

            $el.removeClass(SearchLoadingState[loadingState].toLowerCase());
            loadingState = value;
            $el.addClass(SearchLoadingState[loadingState].toLowerCase());

            if (value == 2 /* Ready */) {
                updateResults();
            }
        }

        function setHasFocus(value) {
            if (hasFocus == value)
                return;
            hasFocus = value;
            $el.toggleClass('has-focus');

            if (!value) {
                $field.val(query);
            } else {
                setQuery('');
                $field.val('');
            }
        }

        function setQuery(value) {
            query = $.trim(value);
            updateResults();
        }

        function setCurrentResult(dir) {
            var $current = $results.find('.current');
            if ($current.length == 0) {
                $results.find(dir == 1 ? 'li:first-child' : 'li:last-child').addClass('current');
            } else {
                var $rel = dir == 1 ? $current.next('li') : $current.prev('li');
                if ($rel.length > 0) {
                    $current.removeClass('current');
                    $rel.addClass('current');
                }
            }
        }

        function gotoCurrentResult() {
            var $current = $results.find('.current');

            if ($current.length == 0) {
                $current = $results.find('li:first-child');
            }

            if ($current.length > 0) {
                window.location.href = $current.find('a').prop('href');
                $field.blur();
            }
        }

        $field.on('focusin', function () {
            setHasFocus(true);
            loadIndex();
        }).on('focusout', function () {
            setTimeout(function () {
                return setHasFocus(false);
            }, 100);
        }).on('input', function () {
            setQuery($.trim($field.val()));
        }).on('keydown', function (e) {
            if (e.keyCode == 13 || e.keyCode == 27 || e.keyCode == 38 || e.keyCode == 40) {
                preventPress = true;
                e.preventDefault();

                if (e.keyCode == 13) {
                    gotoCurrentResult();
                } else if (e.keyCode == 27) {
                    $field.blur();
                } else if (e.keyCode == 38) {
                    setCurrentResult(-1);
                } else if (e.keyCode == 40) {
                    setCurrentResult(1);
                }
            } else {
                preventPress = false;
            }
        }).on('keypress', function (e) {
            if (preventPress)
                e.preventDefault();
        });

        $('body').on('keydown', function (e) {
            if (e.altKey || e.ctrlKey || e.metaKey)
                return;
            if (!hasFocus && e.keyCode > 47 && e.keyCode < 112) {
                $field.focus();
            }
        });
    })(tsd.search || (tsd.search = {}));
    var search = tsd.search;
})(tsd || (tsd = {}));
var tsd;
(function (tsd) {
    $('.tsd-signatures').each(function (n, el) {
        var $signatures, $descriptions;

        function init() {
            var $el = $(el);
            $signatures = $el.find('> .tsd-signature');
            if ($signatures.length < 2) {
                return false;
            }

            var $cn = $el.siblings('.tsd-descriptions');
            $descriptions = $cn.find('> .tsd-description');

            $el.addClass('active');
            $cn.addClass('active');
            return true;
        }

        function setIndex(index) {
            $signatures.removeClass('current').eq(index).addClass('current');
            $descriptions.removeClass('current').eq(index).addClass('current');
        }

        if (init()) {
            $signatures.on('click', function (e) {
                setIndex($signatures.index(e.currentTarget));
            });

            setIndex(0);
        }
    });
})(tsd || (tsd = {}));
