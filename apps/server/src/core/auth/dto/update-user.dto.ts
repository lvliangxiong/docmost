@IsOptional()
is2faEnabled?: boolean;

@IsOptional()
@IsString()
twofaSecret?: string;

@IsOptional()
@IsString()
twofaMethod?: string;

@IsOptional()
twofaBackupCodes?: any; 