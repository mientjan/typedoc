module TypeDoc.Factories
{
    /**
     * A structure used to record the export information of modules.
     *
     * @see [[AstHandler.exports]]
     */
    interface IExportInfo
    {
        /**
         * The name of the exported module.
         */
        name:string;

        /**
         * The type returned by the module.
         */
        type?:Models.BaseType;

        /**
         * The symbol returned by the module.
         */
        symbol?:TypeScript.PullSymbol;
    }


    /**
     * A handler that analyzes and resolves export statements of dynamic modules.
     */
    export class ExportHandler extends BaseHandler
    {
        /**
         * The ast walker factory.
         */
        private factory:TypeScript.AstWalkerFactory;

        /**
         * Collected ambient module export data.
         */
        private exports:IExportInfo[] = [];



        /**
         * Create a new AstHandler instance.
         *
         * @param dispatcher  The dispatcher this handler should be attached to.
         */
        constructor(dispatcher:Dispatcher) {
            super(dispatcher);

            this.factory = TypeScript.getAstWalkerFactory();

            dispatcher.on(Dispatcher.EVENT_BEGIN,             this.onBegin,            this);
            dispatcher.on(Dispatcher.EVENT_BEGIN_DECLARATION, this.onBeginDeclaration, this, 1024);
        }


        /**
         * Triggered once per project before the dispatcher invokes the compiler.
         *
         * @param event  An event object containing the related project and compiler instance.
         */
        private onBegin(event:DispatcherEvent) {
            this.exports = [];
        }


        /**
         * Triggered when the dispatcher starts processing a declaration.
         *
         * @param state  The state that describes the current declaration and reflection.
         */
        private onBeginDeclaration(state:DeclarationState) {
            if (!(state.declaration.kind & TypeScript.PullElementKind.DynamicModule)) {
                return;
            }

            var symbol = this.getExportedSymbol(state.declaration);
            if (symbol) {
                var declarations = [];
                symbol.getDeclarations().forEach((declaration) => {
                    declaration.getParentDecl().getChildDecls().forEach((child) => {
                        if (child.name == declaration.name && declarations.indexOf(child) == -1) {
                            declarations.push(child);
                        }
                    });
                });

                var isPureInternal = true;
                declarations.forEach((declaration) => {
                    var isInternal = false;
                    while (declaration) {
                        if (declaration == state.declaration) isInternal = true;
                        declaration = declaration.getParentDecl();
                    }
                    isPureInternal = isPureInternal && isInternal;
                });

                if (isPureInternal) {
                    this.dispatcher.ensureReflection(state);
                    state.reflection.name = state.declaration.name;
                    state.reflection.isExported = true;

                    ReflectionHandler.sortDeclarations(declarations);
                    declarations.forEach((declaration) => {
                        var childState         = state.createChildState(declaration);
                        childState.originalDeclaration = state.declaration;
                        childState.parentState = state.parentState;
                        childState.reflection  = state.reflection;

                        this.dispatcher.processState(childState);
                        state.reflection = childState.reflection;
                    });

                    state.reflection.kind = state.declaration.kind;
                    ExportHandler.markAsExported(state.reflection);

                    this.exports.push({
                        name: state.declaration.name,
                        type: new Models.ReflectionType(state.reflection, false)
                    });
                } else {
                    this.exports.push({
                        name:   state.declaration.name,
                        symbol: symbol
                    });
                }

                state.stopPropagation();
                state.preventDefault();
            }
        }


        /**
         * Try to find the identifier of the export assignment within the given declaration.
         *
         * @param declaration  The declaration whose export assignment should be resolved.
         * @returns            The found identifier or NULL.
         */
        public getExportedIdentifier(declaration:TypeScript.PullDecl):TypeScript.Identifier {
            var identifier:TypeScript.Identifier = null;

            var ast = declaration.ast();
            if (ast.parent && (ast.parent.kind() & TypeScript.SyntaxKind.ModuleDeclaration)) {
                ast = ast.parent;
            }

            this.factory.simpleWalk(ast, (ast:TypeScript.AST, astState:any) => {
                if (ast.kind() == TypeScript.SyntaxKind.ExportAssignment) {
                    var assignment = <TypeScript.ExportAssignment>ast;
                    identifier = assignment.identifier;
                }
            });

            return identifier;
        }


        /**
         * Try to find the compiler symbol exported by the given declaration.
         *
         * @param declaration  The declaration whose export assignment should be resolved.
         * @returns            The found compiler symbol or NULL.
         */
        public getExportedSymbol(declaration:TypeScript.PullDecl):TypeScript.PullSymbol {
            var identifier = this.getExportedIdentifier(declaration);
            if (identifier) {
                var resolver = declaration.semanticInfoChain.getResolver();
                var context  = new TypeScript.PullTypeResolutionContext(resolver);

                return resolver.resolveAST(identifier, false, context);
            } else {
                return null;
            }
        }


        /**
         * Mark the given reflection and all of its children as being exported.
         *
         * @param reflection  The reflection that should be marked as being exported.
         */
        static markAsExported(reflection:Models.DeclarationReflection) {
            reflection.flags = reflection.flags | TypeScript.PullElementFlags.Exported;
            reflection.children.forEach((child) => ExportHandler.markAsExported(child));
        }
    }


    /**
     * Register this handler.
     */
    Dispatcher.HANDLERS.push(ExportHandler);
}