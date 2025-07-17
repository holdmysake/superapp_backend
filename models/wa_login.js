import { DataTypes } from 'sequelize'
import sequelize from '../config/db.js'
import Field from './field.model.js'
import User from './user.model.js'

const WALogin = sequelize.define('wa_login', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    field_id: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
        references: {
            model: Field,
            key: 'field_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
    },
    user_id: {
        type: DataTypes.STRING(10),
        allowNull: true,
        references: {
            model: User,
            key: 'user_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
    },
    is_login: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
    },
    no_wa: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
}, {
    tableName: 'wa_login',
    timestamps: false,
    underscored: true
})

export default WALogin
